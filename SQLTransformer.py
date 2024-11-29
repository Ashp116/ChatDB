import os

from prettytable import PrettyTable
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import mysql.connector

class SQLTransformer:
    _verbose = False

    db_tables = []
    db_columns = []
    db_schema = []

    model_path = 'gaussalgo/T5-LM-Large-text2sql-spider'  # You can replace this with your model path if you already have a fine-tuned model
    model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
    tokenizer = AutoTokenizer.from_pretrained(model_path)

    def __init__(self):
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
            tables =  [row[0] for row in cursor.fetchall()]

            schema = []
            all_columns = []

            for table in tables:
                cursor.execute(f"DESCRIBE {table};")
                columns = cursor.fetchall()

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

            self.db_schema = "\n [SEP] ".join(schema)
            self.db_columns = all_columns
            self.db_tables = tables

        except mysql.connector.Error as err:
            raise RuntimeError(f"Error generating schema: {err}")
        finally:
            if self.sql_connection.is_connected():
                cursor.close()

    def validate_question(self, question):
        # Check for the presence of valid table names or column names in the question
        valid_tables = self.db_tables
        valid_columns = self.db_columns

        # Verify if the question references valid tables or columns
        for table in valid_tables:
            if table in question.lower():
                return True

        for column in valid_columns:
            if column in question.lower():
                return True

        return False

    def generate_sql_query(self, question):
        if not self.db_schema:
            return "Error: Schema could not be generated from the database."

        if not self.validate_question(question):
            return "Error: The question references invalid tables or columns not found in the schema."

        # Tokenize the input question with the dynamically generated schema
        input_text = f"Question: {question} Schema: {self.db_schema} Please generate a SQL query. Please generate a SQL query that selects all columns (SELECT *) table."
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
                if self._verbose:
                    table = PrettyTable(list(dict.fromkeys(columns)))
                    for row in result:
                        try:
                            table.add_row(row)
                        except:
                            continue
                    print(table)

                return result
            else:
                if self._verbose:
                    print("No results found for the query.")
                return
        except mysql.connector.Error as err:
            raise RuntimeError(f"Error: {err}")
        finally:
            if self.sql_connection.is_connected():
                cursor.close()