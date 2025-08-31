import React from 'react';
import FileUpload from './FileUpload';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>PDF zu durchsuchbarem PDF Konverter</h1>
        <p>
          Laden Sie eine gescannte PDF-Datei hoch. Die Anwendung erstellt eine Kopie Ihres PDFs,
          bei der der erkannte Text unsichtbar über dem Originalbild liegt, um die Datei durchsuchbar zu machen.
        </p>
      </header>
      <main>
        <FileUpload />
      </main>
    </div>
  );
}

export default App;
