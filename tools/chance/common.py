import numpy as np, pandas as pd
L = lambda x: np.log(np.clip(x, 0.05, 1e4))
def prep(path):
    df = pd.read_csv(path)
    df['eta_line1'] = df.eta_line1.fillna(1e4); df['eta_line6'] = df.eta_line6.fillna(1e4)
    df['l_left'] = L(df.left); df['l_share'] = L(df.share)
    df['d_share6'] = (df.share - df.share6).fillna(0); df['d_share24'] = (df.share - df.share24).fillna(0)
    df['l_regen'] = np.log1p(df.regen * 100); df['mo_f'] = df.mo.fillna(-1)
    df['hs'] = np.sin(df.hour / 24 * 2 * np.pi); df['hc'] = np.cos(df.hour / 24 * 2 * np.pi)
    return df
def band_hi(eta): return np.where(eta < 8, eta * 1.98, np.where(eta < 16, eta * 1.83, eta * 1.52))
def at(d, H, model, FEAT):
    e = d.copy(); e['H'] = H; e['lH'] = np.log(H)
    e['r_ours'] = L(d.eta_ours) - np.log(H); e['r_line1'] = L(d.eta_line1) - np.log(H); e['r_line6'] = L(d.eta_line6) - np.log(H)
    e['r_mo'] = np.where(d.mo_left.notna(), L(d.mo_left) - np.log(H), 9)
    e['lab'] = np.where(d.y.notna(), (d.y <= H).astype(float), np.where(d.cens >= H, 0.0, np.nan))
    e['p'] = model.predict_proba(e[FEAT])[:, 1]; e['strict'] = band_hi(d.eta_ours.values) <= H
    return e[e.lab.notna()]
