import os

from prettytable import PrettyTable
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import mysql.connector

class SQLTransformer:
    _verbose = False

    db_schema = {}
    db_schema_context = []
    db_schema_context_str = ''

    model_path = 'gaussalgo/T5-LM-Large-text2sql-spider'  # You can replace this with your model path if you already have a fine-tuned model
    model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
    tokenizer = AutoTokenizer.from_pretrained(model_path)

    def __init__(self, auto_connect=True):
        if auto_connect:
            self.sql_connection = mysql.connector.connect(
                host=os.getenv("DB_HOST"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                database=os.getenv("DB_NAME")
            )

    def connect_to_db(self):
        if not hasattr(self, "sql_connection") or not self.sql_connection.is_connected():
            self.sql_connection = mysql.connector.connect(
                host=os.getenv("DB_HOST"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                database=os.getenv("DB_NAME")
            )

    def generate_db_schema(self):
        cursor = None

        try:
            cursor = self.sql_connection.cursor()

            # Get tables names
            cursor.execute("SHOW TABLES;")
            tables = [row[0] for row in cursor.fetchall()]

            schema = []
            all_columns = []

            for table in tables:
                cursor.execute(f"DESCRIBE {table};")
                columns = cursor.fetchall()

                self.db_schema[table] = columns

                cursor.execute(f"SELECT * FROM {table};")  # Fetch all rows for the table
                rows = cursor.fetchall()

                table_schema = [f'"{table}"']
                primary_keys = []
                foreign_keys = []  # Placeholder for foreign keys if detected

                for column in columns:
                    column_name, column_type, _, key_type, _, _ = column

                    column_type = column_type.split('(')[0] if '(' in column_type else column_type
                    table_schema.append(f'"{column_name}" {column_type}')

                    if key_type == "PRI":
                        primary_keys.append(f'"{column_name}"')
                    elif key_type == "MUL":
                        foreign_keys.append(f'"{column_name}"')

                # Add primary and foreign keys to the schema
                if primary_keys:
                    table_schema.append(f'primary key: {", ".join(primary_keys)}')

                schema.append(" , ".join(table_schema))

                # Save columns for the table
                all_columns.extend([col[0] for col in columns])

            self.db_schema_context = self.db_schema
            self.db_schema_context_str = "\n [SEP] ".join(schema)

        except mysql.connector.Error as err:
            raise RuntimeError(f"Error generating schema: {err}")
        finally:
            if self.sql_connection.is_connected():
                cursor.close()

    def update_db_schema(self, include_tables):
        schema = []
        all_columns = []
        schema_context = {}
        self.db_schema_context = {}

        for table, columns in self.db_schema.items():
            if table not in include_tables:
                continue

            table_schema = [f'"{table}"']
            primary_keys = []
            foreign_keys = []  # Placeholder for foreign keys if detected

            schema_context[table] = columns

            for column in columns:
                column_name, column_type, _, key_type, _, _ = column

                column_type = column_type.split('(')[0] if '(' in column_type else column_type
                table_schema.append(f'"{column_name}" {column_type}')

                if key_type == "PRI":
                    primary_keys.append(f'"{column_name}"')
                elif key_type == "MUL":
                    foreign_keys.append(f'"{column_name}"')

            # Add primary and foreign keys to the schema
            if primary_keys:
                table_schema.append(f'primary key: {", ".join(primary_keys)}')

            schema.append(" , ".join(table_schema))

            # Save columns for the table
            all_columns.extend([col[0] for col in columns])

        self.db_schema_context = schema_context
        self.db_schema_context_str = "\n [SEP] ".join(schema)

        return list(schema_context.keys())

    def export_db_schema_payload(self):
        # Convert the schema into the desired JSON format
        schema_data = []

        for table_name, columns in self.db_schema.items():
            table_data = {
                "tableName": table_name,
                "columns": []
            }

            for column in columns:
                column_name = column[0]
                data_type = column[1].upper()
                table_data["columns"].append({
                    "name": column_name,
                    "dataType": data_type.upper()
                })

            schema_data.append(table_data)

        return {
            'schema_data': schema_data,
            'tables': [table for table in list(self.db_schema_context.keys())]
        }

    def validate_question(self, question):
        # Check for the presence of valid table names or column names in the question
        valid_tables = list(self.db_schema_context.keys())
        valid_columns = [col[0] for col in list(self.db_schema_context.values())[0]]

        # Verify if the question references valid tables or columns
        for table in valid_tables:
            if table.lower() in question.lower():
                return True

        for column in valid_columns:
            if column.lower() in question.lower():
                return True

        return False

    def generate_sql_query(self, question):
        if not self.db_schema_context_str:
            return "Error: Schema could not be generated from the database."

        if not self.validate_question(question):
            return "Error: The question references invalid tables or columns not found in the schema."

        # Tokenize the input question with the dynamically generated schema
        input_text = f"Question: {question} Schema: {self.db_schema_context_str} Please generate a SQL query. Please generate a SQL query that selects all columns (SELECT *) table."
        model_inputs = self.tokenizer(input_text, return_tensors="pt")

        # Generate SQL query
        outputs = self.model.generate(**model_inputs, max_length=512)
        output_text = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)

        return output_text[0]

    def execute_sql_query(self, sql_query):
        if "Error:" in sql_query:
            return

        cursor = None
        try:
            cursor = self.sql_connection.cursor()

            cursor.execute(sql_query)

            # Fetch column names and results
            columns = [col[0] for col in cursor.description]
            result = cursor.fetchall()

            if result:
                # Convert list of tuples to list of dictionaries
                dict_result = [dict(zip(columns, row)) for row in result]

                if self._verbose:
                    table = PrettyTable(list(dict.fromkeys(columns)))
                    for row in result:
                        try:
                            table.add_row(row)
                        except:
                            continue

                return dict_result
            else:
                if self._verbose:
                    print("No results found for the query.")
                return []
        except mysql.connector.Error as err:
            raise RuntimeError(f"Error: {err}")
        finally:
            if self.sql_connection.is_connected():
                cursor.close()