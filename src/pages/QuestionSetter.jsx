import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";

function QuestionSetter() {

  const navigate = useNavigate();

  const handleLogout = async () => {

    await signOut(auth);

    navigate("/");
  };

  return (

    <div className="dashboard">

      <div className="dashboard-header">

        <h1>
          Question Setter Dashboard
        </h1>

        <button
          onClick={handleLogout}
          className="logout-button"
        >
          Logout
        </button>

      </div>

      <div className="dashboard-content">

        <div className="feature-card">

          <h2>
            Upload Question Paper
          </h2>

          <p>
            Upload the examination question paper securely.
          </p>

          <button
            onClick={() =>
              navigate("/upload-question-paper")
            }
          >
            Upload Paper
          </button>

        </div>

        <div className="feature-card">

          <h2>
            View Status
          </h2>

          <p>
            Check the approval status of your uploaded paper.
          </p>

          <button>
            View Status
          </button>

        </div>

        <div className="feature-card">

          <h2>
            Request Approval
          </h2>

          <p>
            Send your uploaded question paper for approval.
          </p>

          <button>
            Request Approval
          </button>

        </div>

      </div>

    </div>
  );
}

export default QuestionSetter;