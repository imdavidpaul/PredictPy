"""
Shared preprocessing utilities used by both feature_selector.py and model_trainer.py.
"""

import pandas as pd
from sklearn.preprocessing import LabelEncoder


def encode_col(series: pd.Series) -> tuple[pd.Series, LabelEncoder]:
    """
    Label-encode a non-numeric column.
    Fills NaN with the sentinel string '__MISSING__' before encoding.
    Returns (encoded_series, fitted_encoder).
    """
    le = LabelEncoder()
    filled = series.fillna("__MISSING__").astype(str)
    encoded = pd.Series(le.fit_transform(filled), index=series.index, name=series.name)
    return encoded, le
