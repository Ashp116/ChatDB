# ChatDB

**ChatDB** is an open-source chatbot that lets you interact with your **MySQL** database using natural language.

Simply type your database inquiries in plain English, and ChatDB translates them into efficient SQL queries to retrieve and manipulate data seamlessly.

## Demo

https://github.com/user-attachments/assets/e4a289fc-0a89-43f1-97b1-94bd4b866a4a


## Info

- **Natural Language to SQL**  
  Converts plain English queries into optimized MySQL commands using the powerful [T5-LM-Large-text2sql-spider model by GaussAlgo](https://huggingface.co/gaussalgo/T5-LM-Large-text2sql-spider). This transformer-based model is fine-tuned specifically for text-to-SQL generation on the Spider dataset, enabling accurate and complex query generation.

-  **Smart Input Classification**  
  Uses a binary classifier to distinguish database queries from unrelated input, improving accuracy and user experience.

-  **Robust Database Connectivity**  
  Works with any MySQL database, enabling dynamic data retrieval and updates.

-  **Multiple Interfaces**  
  Provides both a Command-Line Interface (CLI) and a web-based UI for flexible usage.

## Architecture

```mermaid
%%{init: {"themeVariables": {"primaryColor": "#FF6F61", "secondaryColor": "#6B5B95", "tertiaryColor": "#88B04B", "lineColor": "#333", "textColor": "#fff", "fontSize": "16px"}}}%%
flowchart LR
    A([User Input]) --> B([Input Classifier])
    B -->|DB Query| C([Query Interpreter])
    B -->|Not DB Query| D([Reject or Respond])
    C --> E([Generate SQL])
    E --> F([Execute on MySQL])
    F --> G([Return Results])
    G --> H([Display to User])
````


## Getting Started

### Prerequisites

* Python 3.8+
* Access to a MySQL database instance

### Installation

```bash
git clone https://github.com/Ashp116/ChatDB.git
cd chatdb
pip install -r requirements.txt
cp .env.example .env
# Update .env with your MySQL credentials
python main.py
```


## Usage

* Start the server or CLI application

* Enter natural language queries like:

  * "Show me all the users"
  * "Get me the user in users who has the name Ash"
  * "Show me all the inventory items"

* View formatted results instantly without writing SQL!

