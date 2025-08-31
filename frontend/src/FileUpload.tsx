import React, { useState } from 'react';
import axios from 'axios';

const FileUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Bitte wählen Sie zuerst eine Datei aus.');
      return;
    }

    setIsUploading(true);
    setMessage('PDF wird verarbeitet... dieser Vorgang kann einige Zeit dauern.');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post('/ocr-pdf/', formData, {
        responseType: 'blob', // Important to handle the PDF response
      });

      // Create a URL for the blob
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);

      // Create a link and click it to trigger download
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `searchable_${selectedFile.name}`);
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.parentNode?.removeChild(link);
      URL.revokeObjectURL(fileURL);

      setMessage('Verarbeitung abgeschlossen! Der Download sollte starten.');
      setSelectedFile(null);

    } catch (error: any) {
      let errorDetail = 'Unbekannter Fehler';
      if (error.response && error.response.data) {
        // The response data from the server might be a Blob, which needs to be read
        try {
            const errorJson = JSON.parse(await error.response.data.text());
            errorDetail = errorJson.detail || 'Serverfehler';
        } catch (e) {
            errorDetail = 'Fehlerantwort vom Server konnte nicht gelesen werden.';
        }
      } else if (error.request) {
        errorDetail = 'Server nicht erreichbar. Läuft der Backend-Server?';
      } else {
        errorDetail = error.message;
      }
      setMessage(`Fehler: ${errorDetail}`);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!selectedFile || isUploading}>
        {isUploading ? 'Verarbeite...' : 'PDF hochladen und umwandeln'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default FileUpload;
