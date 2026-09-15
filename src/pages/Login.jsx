import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  signInWithEmailAndPassword
} from "firebase/auth";

import {
  doc,
  getDoc
} from "firebase/firestore";

import { auth, db } from "../firebase";

function Login() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {

    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {

      // Firebase Authentication
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = userCredential.user;

      // Get user role from Firestore
      const userDocRef = doc(
        db,
        "users",
        user.uid
      );

      const userDoc =
        await getDoc(userDocRef);

      if (!userDoc.exists()) {

        setMessage(
          "User role not found. Please contact administrator."
        );

        setLoading(false);

        return;
      }

      const userData = userDoc.data();

      const role = userData.role;

      // Redirect based on role

      if (role === "QUESTION_SETTER") {

        navigate("/question-setter");

      } else if (
        role === "EXAMINATION_OFFICER"
      ) {

        navigate("/officer");

      } else if (
        role === "EXAMINATION_CENTRE"
      ) {

        navigate("/centre");

      } else {

        setMessage("Invalid user role.");
      }

    } catch (error) {

      console.error(error);

      if (
        error.code ===
        "auth/invalid-credential"
      ) {

        setMessage(
          "Invalid email or password."
        );

      } else {

        setMessage(
          "Login failed. Please try again."
        );
      }

    } finally {

      setLoading(false);
    }
  };

  return (

    <div className="login-container">

      <div className="login-card">

        <h1>
          Secure Question Paper System
        </h1>

        <p className="subtitle">
          Secure Examination Question Paper Management
        </p>

        <form
          onSubmit={handleLogin}
        >

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />

          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Logging in..."
              : "Login"}

          </button>

        </form>

        {message && (

          <p className="message">
            {message}
          </p>

        )}

      </div>

    </div>
  );
}

export default Login;