import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

function UploadQuestionPaper() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [examName, setExamName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();

    setMessage("");

    if (!file) {
      setMessage("Please select a PDF file.");
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage("Only PDF files are allowed.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Preparing secure upload...");

      const user = auth.currentUser;

      if (!user) {
        setMessage("User not authenticated.");
        return;
      }

      // Get Firebase Authentication token
      const idToken = await user.getIdToken();

      // Create multipart form data
      const formData = new FormData();

      formData.append("file", file);
      formData.append("exam_name", examName);
      formData.append("subject_name", subjectName);
      formData.append("exam_date", examDate);
      formData.append("exam_time", examTime);

      // Send file to FastAPI backend
      const response = await fetch(
        "http://127.0.0.1:8000/upload-question-paper",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setMessage("Question paper uploaded successfully!");

      setTimeout(() => {
        navigate("/question-setter");
      }, 1500);

    } catch (error) {
      console.error(error);

      setMessage(
        error.message || "Upload failed. Please try again."
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-card">

        <button
          className="back-button"
          onClick={() => navigate("/question-setter")}
        >
          ← Back
        </button>

        <h1>Upload Question Paper</h1>

        <form onSubmit={handleUpload}>

          <label>Examination Name</label>

          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            required
          />

          <label>Subject Name</label>

          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />

          <label>Examination Date</label>

          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />

          <label>Examination Time</label>

          <input
            type="time"
            value={examTime}
            onChange={(e) => setExamTime(e.target.value)}
            required
          />

          <label>Question Paper PDF</label>

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Uploading..."
              : "Upload Question Paper"}
          </button>

        </form>

        {message && (
          <p className="message">{message}</p>
        )}

      </div>
    </div>
  );
}

export default UploadQuestionPaper;