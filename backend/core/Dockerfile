# Use an official Python runtime as the base image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the container
COPY requirements.txt /app/

# Install the Python dependencies
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI app code into the container
COPY . /app/

# Command to run the FastAPI app using Uvicorn
CMD ["python3", "main.py"]