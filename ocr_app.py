import os
import uvicorn
import tempfile
import pytesseract
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pdf2image import convert_from_path
from PyPDF2 import PdfMerger

# Initialize the FastAPI app
app = FastAPI()

@app.post("/ocr-pdf/")
async def ocr_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")

    try:
        # Use a temporary directory to handle files
        with tempfile.TemporaryDirectory() as temp_dir:
            input_pdf_path = os.path.join(temp_dir, file.filename)

            # Save the uploaded PDF to the temp directory
            with open(input_pdf_path, "wb") as f:
                f.write(await file.read())

            # 1. Convert PDF to a list of images
            print("Converting PDF pages to images...")
            images = convert_from_path(input_pdf_path)

            searchable_pdf_pages = []

            # 2. OCR each image and create a searchable PDF page from it
            for i, image in enumerate(images):
                page_num = i + 1
                print(f"Processing page {page_num}...")

                # Use pytesseract to make a searchable PDF from the image
                # The `lang` parameter can be adjusted, e.g., 'eng+deu' for English and German
                page_pdf_bytes = pytesseract.image_to_pdf_or_hocr(image, lang='deu+eng', extension='pdf')

                page_pdf_path = os.path.join(temp_dir, f"page_{page_num}.pdf")
                with open(page_pdf_path, "wb") as f:
                    f.write(page_pdf_bytes)

                searchable_pdf_pages.append(page_pdf_path)

            # 3. Merge the searchable pages into a single PDF
            print("Merging pages...")
            merger = PdfMerger()
            for page_pdf in searchable_pdf_pages:
                merger.append(page_pdf)

            output_pdf_path = os.path.join(temp_dir, f"searchable_{file.filename}")
            merger.write(output_pdf_path)
            merger.close()

            # Return the generated file
            return FileResponse(
                path=output_pdf_path,
                media_type="application/pdf",
                filename=f"searchable_{file.filename}"
            )

    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("ocr_app:app", host="0.0.0.0", port=8000)
