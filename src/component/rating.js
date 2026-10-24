import { useState } from "react";
import axios from "axios";
import "./movie.css";
import { useParams, useNavigate } from "react-router-dom";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Rate() {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const navigate = useNavigate();

  const submitRating = async (event) => {
    event.preventDefault();
    if (!rating) {
      setStatus("Pick a score first.");
      return;
    }
    if (email === null) {
      setStatus("Log in to save a score.");
      navigate("/login");
      return;
    }
    setSubmitting(true);
    setStatus("");
    try {
      await axios.patch(`http://localhost:9000/api/rating/${id}`, { rating });
      setStatus("Saved. Thank you.");
    } catch {
      setStatus("Rating could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="score-panel" onSubmit={submitRating}>
      <div className="score-panel__head">
        <p>Your score</p>
        <strong>{rating ? `${rating} / 10` : "—"}</strong>
      </div>
      <div className="score-chips" role="radiogroup" aria-label="Score">
        {SCORES.map((value) => (
          <button
            key={value}
            type="button"
            className={value <= rating ? "is-on" : ""}
            role="radio"
            aria-checked={value === rating}
            onClick={() => setRating(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <button type="submit" className="rate-button" disabled={submitting || !rating}>
        {submitting ? "Saving" : "Save score"}
      </button>
      {status ? <p className="score-panel__status">{status}</p> : null}
    </form>
  );
}

export default Rate;
