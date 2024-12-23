from dotenv import load_dotenv
from SQLTransformer import SQLTransformer
from webserver import Webserver
import inquirer

load_dotenv()


def cli_loop():
    print("Welcome to the Text-to-SQL CLI! Type 'exit' to quit.\n")

    sql_transformer = SQLTransformer()
    sql_transformer._verbose = True
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
    questions = [
        inquirer.List('interface_type',
                      message="What type of interface do you want?",
                      choices=['Web', 'CLI'],
                      ),
    ]

    user_input = inquirer.prompt(questions)
    if user_input['interface_type'] == "CLI":
        cli_loop()
    elif user_input['interface_type'] == "Web":
        print("Loading webserver...")
        Webserver().run()