## Automatic watermark detection and removal
This was a project that was built as part of project for CS663 (Digital Image Processing).
This is a crude Python implementation of the paper "On The Effectiveness Of Visible Watermarks", Tali Dekel, Michael Rubinstein, Ce Liu and William T. Freeman,
Conference on Computer Vision and Pattern Recongnition (CVPR), 2017.

### Rough sketch of the algorithm
A watermarked image `J` is obtained by imposing a watermark `W` over an unwatermarked image `I` with a blend factor <a href="https://www.codecogs.com/eqnedit.php?latex=\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\alpha" title="\alpha" /></a>. Specifically, we have the following equation:

<div align="center">
<a href="https://www.codecogs.com/eqnedit.php?latex=J(p)&space;=&space;\alpha(p)W(p)&space;&plus;&space;(1-\alpha(p))I(p)" target="_blank"><img src="https://latex.codecogs.com/gif.latex?J(p)&space;=&space;\alpha(p)W(p)&space;&plus;&space;(1-\alpha(p))I(p)" title="J(p) = \alpha(p)W(p) + (1-\alpha(p))I(p)" /></a>
</div>

Where `p = (x, y)` is the pixel location. For a set of `K` images, we have:
<div align="center"><a href="https://www.codecogs.com/eqnedit.php?latex=J_k&space;=&space;\alpha&space;W&space;&plus;&space;(1-\alpha)I_k,\quad&space;k=1,2....K" target="_blank"><img src="https://latex.codecogs.com/gif.latex?J_k&space;=&space;\alpha&space;W&space;&plus;&space;(1-\alpha)I_k,\quad&space;k=1,2....K" title="J_k = \alpha W + (1-\alpha)I_k,\quad k=1,2....K" /></a></div>

Although we have a lot of unknown quantities (<a href="https://www.codecogs.com/eqnedit.php?latex=J_k,&space;W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?J_k,&space;W,&space;\alpha" title="J_k, W, \alpha" /></a>), we can make use of the structural properties of the image to determine its location and estimate its structure. The coherency of <a href="https://www.codecogs.com/eqnedit.php?latex=\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\alpha" title="\alpha" /></a> and W over all the images can be exploited to solve the above problem with good accuracy. The steps followed to determine these values are:
- Initial watermark estimation and detection
- Estimating the matted watermark
- Compute the median of the watermarked image gradients, independently in the `x` and `y` directions, at every pixel location `p`.

<div align="center"><a href="https://www.codecogs.com/eqnedit.php?latex=\nabla{\hat{W_m}(p)}&space;=&space;median_k(\nabla{J_k(p)})" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\nabla{\hat{W_m}(p)}&space;=&space;median_k(\nabla{J_k(p)})" title="\nabla{\hat{W_m}(p)} = median_k(\nabla{J_k(p)})" /></a></div>

- Crop `W_m` to remove boundary regions by computing its magnitude and taking the bounding box of the edge map. The initial estimated watermark <a href="https://www.codecogs.com/eqnedit.php?latex=\hat{W}_m&space;\approx&space;W_m" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\hat{W}_m&space;\approx&space;W_m" title="\hat{W}_m \approx W_m" /></a> is estimated using Poisson reconstruction. Here is an estimated watermark using a dataset of 450+ Fotolia images.
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/watermark.png?raw=True" alt="watermark_est"/>

- Watermark detection: Obtain a verbose edge map (using Canny edge detector) and compute
its Euclidean distance transform, which is then correlated with <a href="https://www.codecogs.com/eqnedit.php?latex=\nabla{\hat{W_m}}" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\nabla{\hat{W_m}}" title="\nabla{\hat{W_m}}" /></a>
to get the Chamfer distance from each pixel to the closest edge.
Lastly, the watermark position is taken to be the pixel with minimum
distance in the map.

#### Multi-image matting and reconstruction
- Estimate <a href="https://www.codecogs.com/eqnedit.php?latex=I_k,&space;W_k" target="_blank"><img src="https://latex.codecogs.com/gif.latex?I_k,&space;W_k" title="I_k, W_k" /></a> keeping <a href="https://www.codecogs.com/eqnedit.php?latex=W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?W,&space;\alpha" title="W, \alpha" /></a> fixed.
- Watermark update - Update the value of <a href="https://www.codecogs.com/eqnedit.php?latex=W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?W" title="W" /></a> keeping the rest fixed.
- Matte update - Update the value of <a href="https://www.codecogs.com/eqnedit.php?latex=W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\alpha" title="\alpha" /></a> keeping the rest fixed.
	
Please refer to the paper and supplementary for a more in-depth description and derivation of the algorithm. 

Results
--------
Here are some of the results for watermarked and watermark removed images: 

<div align="center">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/fotolia_137840668.jpg?raw=True" width="45%">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/137840668.jpg?raw=True" width="45%"> <br>

<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/fotolia_168668046.jpg?raw=True" width="45%">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/168668046.jpg?raw=True" width="45%"> <br>

<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/fotolia_168668150.jpg?raw=True" width="45%">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/168668150.jpg?raw=True" width="45%"> <br>
</div>

However, this is a rough implementation and the removal of watermark leaves some "traces" in form of texture distortion or artifacts. I believe this can be corrected by appropriate parameter tuning. 

More information
-------
For more information, refer to the original paper [here](http://openaccess.thecvf.com/content_cvpr_2017/papers/Dekel_On_the_Effectiveness_CVPR_2017_paper.pdf)

Disclaimer
--------
I do not encourage or endorse piracy by making this project public. The code is free for academic/research purpose. Please feel free to send pull requests for bug fixes/optimizations, etc.

## OCR Functionality

This project also includes a FastAPI application (`ocr_app.py`) that provides OCR (Optical Character Recognition) functionality for PDF files. It uses the NVIDIA NeMo Retriever OCR v1 microservice to extract text from each page of a PDF and generate a searchable PDF.

### Usage

This application provides OCR (Optical Character Recognition) functionality for PDF files using two different OCR models: NVIDIA NeMo Retriever OCR v1 and Tesseract.

#### OCR Models

*   **NVIDIA NeMo Retriever OCR v1:** A powerful OCR model from NVIDIA, optimized for English.
*   **Tesseract:** A popular open-source OCR engine that supports a wide range of languages.

You can select the desired OCR model when you make a request to the `/ocr-pdf/` endpoint.

#### Running the Application

1.  **NVIDIA Model (Optional):** If you want to use the NVIDIA model, you need to have the NVIDIA NeMo Retriever OCR v1 microservice running. You can find instructions on how to run it in the [NVIDIA documentation](https://docs.nvidia.com/nim/ingestion/image-ocr/1.0.0/getting-started.html). By default, the application expects the service to be at `http://localhost:8080/v1/infer`. You can override this by setting the `NVIDIA_OCR_URL` environment variable.

2.  **Tesseract Model (Optional):** If you want to use the Tesseract model, you need to have Tesseract OCR installed on your system. You can find installation instructions on the [official Tesseract website](https://github.com/tesseract-ocr/tesseract).

3.  **Start the FastAPI Application:**
    ```bash
    uvicorn ocr_app:app --host 0.0.0.0 --port 8000
    ```

#### Making a Request

You can send a POST request to the `/ocr-pdf/` endpoint with a PDF file and the desired OCR model.

**Example using cURL:**

*   **NVIDIA Model:**
    ```bash
    curl -X POST -F "file=@/path/to/your/file.pdf" -F "ocr_model=nvidia" http://localhost:8000/ocr-pdf/
    ```

*   **Tesseract Model (for German):**
    ```bash
    curl -X POST -F "file=@/path/to/your/file.pdf" -F "ocr_model=tesseract" -F "lang=deu" http://localhost:8000/ocr-pdf/
    ```






