import React from "react";


function ChatBot() {
  return (
    <div className="chatbot">
     <div style={{ height: "500px", width: "1300px" }}>
    <iframe
        src={`https://ora.sh/embed/517f6610-a4f3-4c88-8d63-aac0e96809f4`}
        width="1350px"
        height="500"
        style={{ border: "0", borderRadius: "4px" }}
    />
</div>
    </div>
  );
}
export default ChatBot;