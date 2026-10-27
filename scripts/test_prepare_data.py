import copy
import json
from pathlib import Path
import unittest

from prepare_data import FILES, ROOT, DEFAULT_SOURCE, metrics, number, read_csv, validate_and_join


class ResearchDataTests(unittest.TestCase):
    def test_metrics_known_values(self):
        self.assertEqual(metrics([1, 2, 3], [1, 2, 3]), {'RMSE': 0, 'MAE': 0, 'R2': 1})
        self.assertAlmostEqual(metrics([0, 2], [1, 1])['R2'], 0)

    def test_reject_nonfinite_values(self):
        for value in ['nan', 'inf', '-inf', 'invalid']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                number(value, 'test')

    def test_actual_artifacts_and_generated_data(self):
        data = json.loads((ROOT / 'src/research-data.json').read_text())
        self.assertEqual(len(data['records']), 113)
        self.assertEqual(len({r['id'] for r in data['records']}), 113)
        for view in data['views']:
            calculated = metrics([r['target'] for r in data['records']], [r['predictions'][view['key']] for r in data['records']])
            self.assertEqual(calculated, view['metrics'])
        for record in data['records']:
            self.assertLess(abs(sum(record['gates']) - 1), 1e-5)
            self.assertTrue(all(0 <= g <= 1 for g in record['gates']))
            self.assertTrue((ROOT / 'public' / record['structure']).is_file())
            if record['conformer']:
                geometry = json.loads((ROOT / 'public' / record['conformer']).read_text())
                self.assertTrue(geometry['atoms'])
                for bond in geometry['bonds']:
                    self.assertLess(max(bond['start'], bond['end']), len(geometry['atoms']))

    @unittest.skipUnless(DEFAULT_SOURCE.exists(), 'Original research repository unavailable')
    def test_bad_alignment_gate_and_summary_fail(self):
        tables = {key: read_csv(DEFAULT_SOURCE / 'outputs' / name) for key, name, _ in FILES}
        summary = read_csv(DEFAULT_SOURCE / 'outputs/views_evaluation_summary.csv')
        records, _ = validate_and_join(tables, summary)
        self.assertEqual(len(records), 113)
        bad = copy.deepcopy(tables)
        bad['view1'][0], bad['view1'][1] = bad['view1'][1], bad['view1'][0]
        with self.assertRaisesRegex(ValueError, 'alignment'):
            validate_and_join(bad, summary)
        bad = copy.deepcopy(tables)
        bad['fused'][0]['gate_w_v1'] = '1.5'
        with self.assertRaisesRegex(ValueError, 'gating'):
            validate_and_join(bad, summary)
        bad_summary = copy.deepcopy(summary)
        bad_summary[0]['RMSE'] = '0.542'
        with self.assertRaisesRegex(ValueError, 'Summary mismatch'):
            validate_and_join(tables, bad_summary)


if __name__ == '__main__':
    unittest.main()
