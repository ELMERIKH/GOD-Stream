import React, { useState, useEffect } from "react";
import axios from "../API/auth";

function Comments({ user, movie }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const email = localStorage.getItem("email");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchData = async () => {
      try {
        const res = await axios.get(`/api/comments/getall?movie=${encodeURIComponent(movie || "")}`);
        if (!cancelled) {
          setComments(Array.isArray(res.data?.comments) ? res.data.comments : []);
        }
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [movie]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || posting) return;
    if (email === null) {
      setNote("Log in to post a comment.");
      return;
    }
    setPosting(true);
    setNote("");
    try {
      const res = await axios.post("/api/comments/create", {
        text: body,
        email: user,
        movieId: movie,
      });
      const created = res.data?.comment || res.data;
      setComments((current) => [
        {
          _id: created?._id || `local-${Date.now()}`,
          email: created?.email || user || email,
          text: created?.text || body,
        },
        ...current,
      ]);
      setText("");
      setNote("Comment posted.");
    } catch {
      setNote("Comment could not be posted.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="comments">
      <div className="comments__head">
        <h2>Comments</h2>
        <span>{loading ? "Loading" : `${comments.length}`}</span>
      </div>
      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          placeholder="Share a thought about this title"
          value={text}
          rows={3}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" disabled={posting || !text.trim()}>
          {posting ? "Posting" : "Post comment"}
        </button>
      </form>
      {note ? <p className="comments__note">{note}</p> : null}
      {loading ? (
        <div className="comment-list" aria-hidden="true">
          <div className="comment-card is-loading" />
          <div className="comment-card is-loading" />
        </div>
      ) : null}
      {!loading && comments.length === 0 ? (
        <div className="comments__empty">
          <p>No comments yet</p>
          <span>Be the first to leave a note on this title.</span>
        </div>
      ) : null}
      {!loading && comments.length > 0 ? (
        <div className="comment-list">
          {comments.map((comment) => (
            <article key={comment._id} className="comment-card">
              <h3>{comment.email || "Viewer"}</h3>
              <p>{comment.text}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default Comments;
