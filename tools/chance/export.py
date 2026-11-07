import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json, numpy as np, pandas as pd, warnings; warnings.filterwarnings('ignore')
from sklearn.ensemble import HistGradientBoostingClassifier
from common import prep, at
df = prep('feat.csv')
FEAT = ['lH', 'r_ours', 'r_line1', 'r_line6', 'l_left', 'l_share', 'd_share6', 'd_share24', 'l_regen', 'pace1', 'pace6', 'pace24', 'mo_f', 'dss']
mono = [1 if f == 'lH' else -1 if f in ('r_ours', 'r_line1', 'r_line6') else 0 for f in FEAT]
HS = [6, 12, 18, 24, 36, 48, 72, 96, 120]
dummy = type('M', (), {'predict_proba': lambda s, X: np.zeros((len(X), 2))})()
allrows = pd.concat([at(df, H, dummy, FEAT) for H in HS], ignore_index=True)
m = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.08, max_iter=100, l2_regularization=1.0, min_samples_leaf=60, monotonic_cst=mono, random_state=0).fit(allrows[FEAT], allrows.lab)
trees = []
for (pr,) in m._predictors:
    out = []
    for n in pr.nodes:
        out.append([float(n['value'])] if n['is_leaf'] else [int(n['feature_idx']), float(n['num_threshold']), int(n['left']), int(n['right']), int(n['missing_go_to_left'])])
    trees.append(out)
model = {'feat': FEAT, 'base': float(m._baseline_prediction.ravel()[0]), 'trees': trees}
json.dump(model, open('chance_model.json', 'w'), separators=(',', ':'))
import pickle; pickle.dump(m, open('chance_m.pkl', 'wb'))
# parity fixture: 40 rows across horizons, with NaNs kept
rng = np.random.default_rng(3); idx = rng.choice(len(allrows), 40, replace=False)
fx = [{'x': [None if pd.isna(v) else float(v) for v in allrows.iloc[i][FEAT].values], 'p': float(m.predict_proba(allrows.iloc[[i]][FEAT])[:, 1][0])} for i in idx]
json.dump(fx, open('chance_fixture.json', 'w'))
print('trees', len(trees), 'bytes', os.path.getsize('chance_model.json'), 'fixture', len(fx))
