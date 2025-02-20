import Header from "./Header";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import DeleteIcon from "@mui/icons-material/Delete";
import "./App.css";
import { useState, useRef, useEffect } from "react";
import LanguageDetect from "languagedetect";

const lngDetector = new LanguageDetect();
const HF_API_KEY = "";

const languageCodes = {
    English: "en",
    French: "fr",
    Spanish: "es",
    Portuguese: "pt",
    Russian: "ru",
    Turkish: "tr"
};

export default function Home() {
    const [userInput, setUserInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState(() => {
        return JSON.parse(localStorage.getItem("conversations")) || [];
    });
    const [activeChat, setActiveChat] = useState(null);
    const outputRef = useRef(null);

    const detectLanguage = (text) => {
        const detected = lngDetector.detect(text, 1);
        return detected.length > 0 ? detected[0][0] : "Unknown";
    };

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        localStorage.setItem("conversations", JSON.stringify(conversations));
    }, [conversations]);

    const translateText = async (text, targetLang) => {
        try {
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
            );
            const data = await response.json();
            return data.responseData?.translatedText || text;
        } catch (error) {
            console.error("Translation error:", error);
            return text;
        }
    };

    const summarizeText = async (text) => {
        try {
            const response = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HF_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: text }),
            });

            const data = await response.json();
            return data[0]?.summary_text || "Summarization failed.";
        } catch (error) {
            console.error("Summarization error:", error);
            return "Summarization error.";
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (userInput.trim() === '') return;

        const detectedLang = detectLanguage(userInput);
        const newMessage = { 
            text: userInput, 
            language: detectedLang, 
            selectedLanguage: "default", 
            response: "", 
            summary: "", 
            loading: false 
        };

        setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, newMessage];

            setConversations(prevConversations => {
                let updatedConversations = [...prevConversations];

                if (activeChat !== null) {
                    updatedConversations[activeChat].messages = updatedMessages;
                } else {
                    updatedConversations.push({ title: `Chat ${updatedConversations.length + 1}`, messages: updatedMessages });
                    setActiveChat(updatedConversations.length - 1);
                }

                return updatedConversations;
            });

            return updatedMessages;
        });

        setUserInput('');
    };

    const updateMessageInConversation = (index, updatedMessage) => {
        setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            updatedMessages[index] = updatedMessage;

            setConversations(prevConversations => {
                const updatedConversations = [...prevConversations];
                if (activeChat !== null) {
                    updatedConversations[activeChat].messages = updatedMessages;
                }
                return updatedConversations;
            });

            return updatedMessages;
        });
    };

    const handleLanguageChange = async (index, newLang) => {
        const updatedMessage = { ...messages[index], selectedLanguage: newLang, loading: true };
        updateMessageInConversation(index, updatedMessage);

        if (newLang !== messages[index].language) {
            const langCode = languageCodes[newLang] || "en";
            const translatedText = await translateText(messages[index].text, langCode);

            updateMessageInConversation(index, {
                ...updatedMessage,
                response: translatedText,
                responseLanguage: newLang,
                loading: false
            });
        } else {
            updateMessageInConversation(index, { ...updatedMessage, response: "", responseLanguage: "", loading: false });
        }
    };

    const handleSummarize = async (index) => {
        const updatedMessage = { ...messages[index], loading: true };
        updateMessageInConversation(index, updatedMessage);

        const summary = await summarizeText(messages[index].text);

        updateMessageInConversation(index, {
            ...updatedMessage,
            summary: summary,
            summaryLanguage: "English",
            loading: false
        });
    };

    const startNewChat = () => {
        setMessages([]);
        setActiveChat(null);
    };

    const loadConversation = (index) => {
        setActiveChat(index);
        setMessages(conversations[index].messages);
    };

    const deleteConversation = (index) => {
        setConversations(prevConversations => {
            const updatedConversations = prevConversations.filter((_, i) => i !== index);

            if (index === activeChat) {
                setMessages([]);
                setActiveChat(null);
            } else if (index < activeChat) {
                setActiveChat(prev => prev - 1);
            }

            return updatedConversations;
        });
    };

    return (
        <>
            <Header />
            <div id="home">
                <aside id="sidebar">
                    <span id="newchat" onClick={startNewChat}>New Chat</span>
                    <ul id="chat-list">
                        {conversations.map((conv, index) => (
                            <li key={index} id="oldchat">
                                <span onClick={() => loadConversation(index)}>
                                    {conv.title} 
                                    <button 
    className="delete-btn" 
    onClick={() => deleteConversation(index)}
    aria-label={`Delete conversation ${conv.title}`}
>
    <DeleteIcon />
</button>

                                </span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <section id="chat">
                <section id="output" ref={outputRef} aria-live="polite">
    {messages.map((msg, index) => (
        <div key={index} className="conversation">
            <div className="message user-message">
                <p>{msg.text}</p>

                <button 
                    id="language" 
                    aria-label={`Detected language: ${msg.language}`}
                >
                    Language: {msg.language}
                </button>

                <select 
                    value={msg.selectedLanguage} 
                    onChange={(e) => handleLanguageChange(index, e.target.value)}
                    aria-label="Select language for translation"
                >
                    <option value="default" disabled hidden>Translate</option>                                        
                    {Object.keys(languageCodes).map(lang => (
                        <option key={lang} value={lang}>
                            {lang} ({languageCodes[lang]})
                        </option>
                    ))}
                </select>

                {msg.text.length > 150 && msg.language === "English" && (
                    <button 
                        id="summarize-btn" 
                        onClick={() => handleSummarize(index)}
                        aria-label="Summarize this message"
                    >
                        Summarize
                    </button>
                )}
            </div>

            {(msg.loading || msg.response || msg.summary) && (
                <div className="message response-message">
                    {msg.loading ? (
                        <CircularProgress size={24} color="primary" aria-label="Loading response..." />
                    ) : (
                        <>
                            {msg.response && (
                                <>
                                    <p id="bot-response">{msg.response}</p>
                                    <button 
                                        id="language" 
                                        aria-label={`Response language: ${msg.responseLanguage}`}
                                    >
                                        Language: {msg.responseLanguage}
                                    </button>
                                </>
                            )}
                            {msg.summary && (
                                <>
                                    <p id="summary-response">{msg.summary}</p>
                                    <button 
                                        id="language" 
                                        aria-label="Summary language: English"
                                    >
                                        Language: {msg.summaryLanguage}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    ))}
</section>


                    <form id="input" onSubmit={handleSubmit}>
    <textarea 
        required 
        placeholder="Message LangGPT" 
        rows={2} 
        value={userInput} 
        onChange={(e) => setUserInput(e.target.value)} 
        aria-label="Message input field"
    />
    <button 
        id="send-icon" 
        type="submit"
        aria-label="Send message"
    >
        <SendIcon />
    </button>
</form>

                    
                </section>
            </div>
        </>
    );
}
