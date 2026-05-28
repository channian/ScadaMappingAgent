import pandas as pd
import sqlite3
from pathlib import Path


class SqliteManager:
    def __init__(self, db_path):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    def create_table(self, db_tables):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for table_name, columns_structure in db_tables.items():
                create_table_instruction = f"CREATE TABLE IF NOT EXISTS {table_name} ("
                for column_name, column_setting in columns_structure.items():
                    create_table_instruction = ' '.join([create_table_instruction, column_name, column_setting, ','])
                create_table_instruction = create_table_instruction[:-1]
                create_table_instruction += ')'
                cursor.execute(create_table_instruction)

    def data_insert(self, table_name, insert_data):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            insert_data_instruction = f'INSERT INTO {table_name} ('
            for column_name in insert_data.columns:
                insert_data_instruction = ' '.join([insert_data_instruction, column_name, ','])
            insert_data_instruction = insert_data_instruction[:-1]
            insert_data_instruction += ')\n'
            insert_data_instruction += 'VALUES ('
            value_placeholder = ', '.join('?' * insert_data.shape[1])
            insert_data_instruction = ''.join([insert_data_instruction, value_placeholder, ')'])
            cursor.executemany(insert_data_instruction, insert_data.values.tolist())
