import os

from transformers import pipeline
from datetime import datetime
import re

# Create a pipeline to handle text-to-timestamp conversion
def text_to_timestamp(input_text):
    # Use a pre-trained transformer model for text recognition
    nlp = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

    # Here, we look for date-related expressions in the text
    possible_dates = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    # Check if the input matches a recognized month/year pattern
    month_match = None
    for month in possible_dates:
        if month in input_text:
            month_match = month
            break

    if month_match:
        # Try to extract the year and month information
        year_search = re.search(r'(\d{4})', input_text)
        if year_search:
            year = year_search.group(1)
            month_number = possible_dates.index(month_match) + 1

            # Construct a date (default day is 1)
            timestamp = datetime(year=int(year), month=month_number, day=1)
            return timestamp.strftime("%Y-%m-%d %H:%M:%S")

    return "Unable to parse the date from input text."


# Example usage:
input_text = "Jan of 2023"
timestamp_string = text_to_timestamp(input_text)
print(timestamp_string)  # Output: "2023-01-01 00:00:00"


from transformers import AutoModelForSequenceClassification, AutoTokenizer
import numpy as np

# Specify the directory where you extracted the model
current_dir = os.getcwd()
local_model_dir = current_dir+"\\classifier\\trained_model.zip"

# Load the model and tokenizer from the local directory
model = AutoModelForSequenceClassification.from_pretrained(local_model_dir)
tokenizer = AutoTokenizer.from_pretrained(local_model_dir)

print("Model and tokenizer loaded successfully")

def predict(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    outputs = model(**inputs)
    logits = outputs.logits.detach().numpy()
    prediction = np.argmax(logits, axis=1)[0]
    return "SQL" if prediction == 1 else "Other"

print(predict("Give me all the users"))

