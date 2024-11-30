import asyncio
import base64
import os
import subprocess
import uuid
from datetime import datetime
from decimal import Decimal

import websockets
import json
from SQLTransformer import SQLTransformer

current_dir = os.path.dirname(__file__)
URL = os.path.join(current_dir, 'public', 'index.html')

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

                generated_sql = self.sql_transformer.generate_sql_query(data["user_input"])
                response = {"reply": f"Generated SQL: {generated_sql}"}

                try:
                    result = self.sql_transformer.execute_sql_query(generated_sql)
                    response["db_result"] = result
                except Exception as e:
                    response["db_result"] = None
                    response["error"] = str(e)

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