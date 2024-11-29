from dotenv import load_dotenv
from SQLTransformer import SQLTransformer

load_dotenv()

sql_transformer = SQLTransformer()
sql_transformer._verbose = True

def cli_loop():
    print("Welcome to the Text-to-SQL CLI! Type 'exit' to quit.\n")

    sql_transformer.generate_db_schema()

    while True:
        user_question = input("Please enter your question: ")

        if user_question.lower() == "exit":
            print("Exiting the CLI. Goodbye!")
            break

        generated_sql = sql_transformer.generate_sql_query(user_question)
        print(f"Generated SQL Query: {generated_sql}\n")

        try:
            result = sql_transformer.execute_sql_query(generated_sql)
        except:
            pass

if __name__ == "__main__":
    cli_loop()
