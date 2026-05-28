import os
import pandas as pd
from sqlalchemy import create_engine, text


def _get_engine():
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    db_dsn = os.environ.get('DB_DSN')
    db_name = os.environ.get('DB_NAME', 'TagSystem')
    return create_engine(f'postgresql+psycopg2://{db_user}:{db_password}@{db_dsn}/{db_name}')


def _query_io_list(tag_names):
    engine = _get_engine()
    query = text("""
        SELECT a_tag, a_desc, a_iodv, a_ioad,
               a_scale_enabled, a_scale_rawlow, a_scale_rawhigh,
               a_scale_low, a_scale_high
        FROM scada_iolist_master
        WHERE a_tag = ANY(:tag_names)
    """)
    return pd.read_sql(query, engine, params={"tag_names": tag_names})


def _to_kepware_format(io_list):
    col_map = {
        'a_tag': 'Tag Name',
        'a_desc': 'Description',
        'a_iodv': 'I/O DEVICE',
        'a_ioad': 'I/O ADDRESS',
        'a_scale_enabled': 'SCALE Enabled',
        'a_scale_rawlow': 'Raw Low',
        'a_scale_rawhigh': 'Raw High',
        'a_scale_low': 'Scaled Low',
        'a_scale_high': 'Scaled High',
    }
    df = io_list.rename(columns=col_map)[list(col_map.values())]
    df.insert(0, 'Site', df['Tag Name'].apply(lambda t: t.split('_')[0]))
    df.insert(1, 'System', df['Tag Name'].apply(
        lambda t: t.split('_')[2] if len(t.split('_')) > 2 else ''
    ))
    df.insert(2, 'SCADA Node Name', df['Site'] + df['System'])
    df['專案名稱'] = None
    df['DataOwner'] = None
    return df


def tag_name_checker(tag_name_df):
    tag_names = tag_name_df['tag_name'].dropna().tolist()
    io_list = _query_io_list(tag_names)
    kepware_df = _to_kepware_format(io_list)
    found_tags = set(kepware_df['Tag Name'])
    error_df = tag_name_df[~tag_name_df['tag_name'].isin(found_tags)].copy()
    return kepware_df, error_df
