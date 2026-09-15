import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";

function ExaminationCentre() {

  const navigate = useNavigate();

  const handleLogout = async () => {

    await signOut(auth);

    navigate("/");
  };

  return (

    <div className="dashboard">

      <div className="dashboard-header">

        <h1>
          Examination Centre Dashboard
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
            Examination Papers
          </h2>

          <p>
            Access will be provided only during the authorized examination time.
          </p>

          <button>
            Check Available Papers
          </button>

        </div>

      </div>

    </div>
  );
}

export default ExaminationCentre;