import asyncio
import base64
import os
import subprocess
import uuid
from datetime import datetime
from decimal import Decimal

import websockets
import json
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import numpy as np
from SQLTransformer import SQLTransformer

current_dir = os.path.dirname(__file__)
URL = os.path.join(current_dir, 'public', 'index.html')

# Load the input classifier model and tokenizer from the local directory
local_model_dir = os.getcwd()+"\\classifier\\trained_model"
input_classifier = AutoModelForSequenceClassification.from_pretrained(local_model_dir)
input_classifying_tokenizer = AutoTokenizer.from_pretrained(local_model_dir)

def classify_text(text):
    inputs = input_classifying_tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    outputs = input_classifier(**inputs)
    logits = outputs.logits.detach().numpy()
    prediction = np.argmax(logits, axis=1)[0]
    return "SQL" if prediction == 1 else "Other"

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()  # Convert datetime to ISO format string
        if isinstance(obj, Decimal):
            return float(obj)  # Convert Decimal to float
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')  # Convert bytes to base64 string
        if isinstance(obj, uuid.UUID):
            return str(obj)  # Convert UUID to string
        if obj is None:
            return None  # Convert NoneType to None (JSON's null)
        return super().default(obj)

class Webserver:
    # Track the single connected client
    current_client = None
    sql_transformer = SQLTransformer(auto_connect=False)

    def user_question(self, data):
        input_type = classify_text(data['user_input'])
        response = {}

        if input_type == "Other":
            response['reply'] = """Oh ho! I don't quite understand that, but no worries—I'm here to help! 😅 I can assist you in searching your database and pulling the information you need. Just let me know what you're looking for!"""

        elif input_type == "SQL":
            generated_sql = self.sql_transformer.generate_sql_query(data["user_input"])

            if "error" in generated_sql.lower():
                response = {"reply": """Oh ho! That request has me spinning my gears. 🤖 Try rephrasing it and let me know where I should look in the database—I'll do my best to assist you!"""}
            else:
                response = {"reply": f"Generated SQL: {generated_sql}"}

                try:
                    result = self.sql_transformer.execute_sql_query(generated_sql)
                    response["db_result"] = result
                except Exception as e:
                    response["db_result"] = None
                    response["error"] = str(e)

        return response

    async def handle_connection(self, websocket):
        # Disconnect the previous client if there is one
        if self.current_client is not None:
            try:
                await self.current_client.close()
                print("Disconnected previous client.")
            except websockets.exceptions.ConnectionClosed:
                print("Previous client was already disconnected.")

        # Set the new client as the current client
        self.current_client = websocket

        try:
            async for message in websocket:
                print(f"Received: {message}")

                # Example: Parse the message and send back a response
                data = json.loads(message)
                response = {}

                if 'user_input' in data:
                    response = self.user_question(data)
                elif 'get_schema_context' in data:
                    response['db_schema_context'] = self.sql_transformer.export_db_schema_payload()
                    response['get_schema_context'] = True
                elif 'schema_context_update' in data:
                    response["schema_context_updated"] = self.sql_transformer.update_db_schema(data['schema_context_update'])
                await websocket.send(json.dumps(response, cls=CustomJSONEncoder))
        except websockets.exceptions.ConnectionClosed as e:
            print("Connection closed:", e)
        finally:
            # Reset the current client when the connection is closed
            if self.current_client == websocket:
                self.current_client = None

    async def start_server(self):
        self.sql_transformer.connect_to_db()
        self.sql_transformer.generate_db_schema()
        # Start the WebSocket server
        async with websockets.serve(self.handle_connection, "localhost", 8765, ping_interval=10, ping_timeout=30):
            print("WebSocket server is running on ws://localhost:8765")
            await asyncio.Future()  # Run forever

    def run(self):
        try:
            os.startfile(URL)
        except AttributeError:
            try:
                subprocess.call(['open', URL])
            except:
                print(f'Could not open {URL}')
        asyncio.run(self.start_server())