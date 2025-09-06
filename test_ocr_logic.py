import asyncio
import io
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from fastapi import UploadFile
from ocr_app import call_nvidia_ocr_service, generate_hocr, ocr_pdf, OCRModel

# A minimal valid PDF
minimal_pdf = b"""%PDF-1.0
1 0 obj
<< /Type /Catalog
   /Pages 2 0 R
>>
endobj
2 0 obj
<< /Type /Pages
   /Kids [3 0 R]
   /Count 1
>>
endobj
3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /MediaBox [0 0 100 100]
>>
endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4
   /Root 1 0 R
>>
startxref
178
%%EOF
"""

# Sample JSON response from NVIDIA OCR service
mock_ocr_response = {
    "data": [
        {
            "index": 0,
            "text_detections": [
                {
                    "text_prediction": {"text": "Hello", "confidence": 0.9},
                    "bounding_box": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.1}, {"x": 0.2, "y": 0.2}, {"x": 0.1, "y": 0.2}]}
                }
            ]
        }
    ]
}

class TestOcrApp(unittest.TestCase):

    @patch('ocr_app.requests.post')
    def test_call_nvidia_ocr_service(self, mock_requests_post):
        mock_requests_post.return_value.json.return_value = mock_ocr_response
        mock_requests_post.return_value.raise_for_status = MagicMock()
        image = MagicMock()
        image.save = MagicMock()
        result = call_nvidia_ocr_service(image)
        self.assertEqual(result, mock_ocr_response)
        mock_requests_post.assert_called_once()

    def test_generate_hocr(self):
        hocr_content = generate_hocr(mock_ocr_response, 1000, 1000)
        self.assertIsInstance(hocr_content, str)
        self.assertIn("<html", hocr_content)
        self.assertIn("ocrx_word", hocr_content)
        self.assertIn("Hello", hocr_content)
        self.assertIn("bbox 100 100 200 200", hocr_content)

class TestOcrAppIntegration(unittest.TestCase):

    @patch('ocr_app.pytesseract.image_to_pdf_or_hocr')
    @patch('ocr_app.subprocess.run')
    @patch('ocr_app.convert_from_path')
    @patch('ocr_app.call_nvidia_ocr_service')
    def test_ocr_pdf_integration(self, mock_call_ocr, mock_convert, mock_subprocess, mock_pytesseract):

        async def run_test(ocr_model, lang="eng"):
            with tempfile.TemporaryDirectory() as temp_dir:
                # Mock dependencies
                mock_call_ocr.return_value = mock_ocr_response
                mock_pytesseract.return_value = minimal_pdf
                mock_image = MagicMock()
                mock_image.width = 1000
                mock_image.height = 1000
                mock_image.save = MagicMock()
                mock_convert.return_value = [mock_image]

                def create_dummy_pdf(*args, **kwargs):
                    save_path = args[0][2]
                    with open(save_path, "wb") as f:
                        f.write(minimal_pdf)
                mock_subprocess.side_effect = create_dummy_pdf

                # Create mock UploadFile
                pdf_io = io.BytesIO(minimal_pdf)
                mock_upload_file = UploadFile(filename="test.pdf", file=pdf_io, headers={"content-type": "application/pdf"})

                with patch('ocr_app.tempfile.TemporaryDirectory') as mock_tempdir:
                    mock_tempdir.return_value.__enter__.return_value = temp_dir

                    response = await ocr_pdf(file=mock_upload_file, ocr_model=ocr_model, lang=lang)

                    self.assertEqual(response.media_type, "application/pdf")
                    mock_convert.assert_called_once()
                    if ocr_model == OCRModel.NVIDIA:
                        mock_call_ocr.assert_called_once()
                    elif ocr_model == OCRModel.TESSERACT:
                        mock_pytesseract.assert_called_once()

                # Reset mocks for the next run
                mock_convert.reset_mock()
                mock_call_ocr.reset_mock()
                mock_pytesseract.reset_mock()

        # Test NVIDIA path
        asyncio.run(run_test(OCRModel.NVIDIA))

        # Test Tesseract path
        asyncio.run(run_test(OCRModel.TESSERACT, lang="deu"))

if __name__ == '__main__':
    unittest.main()
