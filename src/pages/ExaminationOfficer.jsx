import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";

function ExaminationOfficer() {

  const navigate = useNavigate();

  const handleLogout = async () => {

    await signOut(auth);

    navigate("/");
  };

  return (

    <div className="dashboard">

      <div className="dashboard-header">

        <h1>
          Examination Officer Dashboard
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
            Pending Approvals
          </h2>

          <p>
            View question papers waiting for approval.
          </p>

          <button>
            View Papers
          </button>

        </div>

        <div className="feature-card">

          <h2>
            Approve Question Paper
          </h2>

          <p>
            Approve or reject submitted question papers.
          </p>

          <button>
            Manage Approval
          </button>

        </div>

      </div>

    </div>
  );
}

export default ExaminationOfficer;