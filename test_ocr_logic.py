import asyncio
import os
from ocr_app import ocr_pdf
from fastapi import UploadFile
import io

async def run_test():
    print("Starting backend logic test...")

    # Path to the test PDF
    pdf_path = "Matting-Levin-Lischinski-Weiss-PAMI.pdf"

    if not os.path.exists(pdf_path):
        print(f"Test PDF not found at {pdf_path}")
        return

    try:
        # Create a mock UploadFile object
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
            pdf_io = io.BytesIO(pdf_bytes)
            mock_upload_file = UploadFile(
                filename="test.pdf",
                file=pdf_io,
                content_type="application/pdf"
            )

        print("Mock UploadFile created. Calling ocr_pdf function...")

        # Call the main function from our app
        response = await ocr_pdf(file=mock_upload_file)

        # Check the response type
        if response and hasattr(response, 'media_type') and response.media_type == 'application/pdf':
            print("Test successful: The ocr_pdf function returned a PDF response.")
        else:
            print(f"Test failed: Unexpected response type. Got {type(response)}")

    except Exception as e:
        print(f"An error occurred during the test: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
