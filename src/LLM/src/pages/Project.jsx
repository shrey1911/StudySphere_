import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { initializeSocket, receiveMessage, sendMessage } from '../utils/socket.jsx'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import { getWebContainer } from '../utils/webContainer.jsx'
import { apiConnector } from '../services/apiconnector.js'
import { useSelector } from 'react-redux';

// Initialize highlight.js with specific languages
hljs.configure({
    languages: ['javascript', 'python', 'html', 'css', 'json', 'jsx', 'typescript', 'bash', 'plaintext'],
});

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-')) {
            hljs.highlightElement(ref.current)
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}

const Project = () => {
    const location = useLocation()
    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ selectedUserId, setSelectedUserId ] = useState(new Set())
    const [ project, setProject ] = useState(location.state.project)
    const [ message, setMessage ] = useState('')
    const {user} = useSelector((state) => state.profile)
    const {token} = useSelector((state) => state.auth);
    const messageBox = React.createRef()

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState([])
    const [ fileTree, setFileTree ] = useState({})

    const [ currentFile, setCurrentFile ] = useState(null)
    const [ openFiles, setOpenFiles ] = useState([])

    const [ webContainer, setWebContainer ] = useState(null)
    const [ iframeUrl, setIframeUrl ] = useState(null)
    const [ runProcess, setRunProcess ] = useState(null)

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }
            return newSelectedUserId;
        });
    }

    async function addCollaborators() {
        try {
            const res = await apiConnector(
                "PUT",
                `http://localhost:4000/projects/add-user`,
                {
                    projectId: location.state.project._id,
                    users: Array.from(selectedUserId)
                },
                {
                    Authorization: `Bearer ${token}`,
                }
            );
            setIsModalOpen(false);
        } catch (err) {
            console.log(err);
        }
    }

    const send = () => {
        if (!message.trim()) return;
        
        const messageData = {
            message,
            sender: user,
            timestamp: Date.now()
        };
        
        sendMessage('project-message', messageData);
        
        setMessages(prevMessages => [...prevMessages, messageData]);
        setMessage("");
    }

    function WriteAiMessage(message) {
        const messageObject = JSON.parse(message)
        return (
            <div className='overflow-auto text-md bg-slate-950 text-white rounded-sm p-2'>
                <Markdown
                    children={messageObject.text}
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                />
            </div>)
    }

    useEffect(() => {
        initializeSocket(project._id, token);
        
        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
                console.log("container started",container);
            })
        }

        receiveMessage('project-message', data => {
            if (data.sender._id === 'ai') {
                const message = JSON.parse(data.message)
                if (webContainer && message.fileTree) {
                    webContainer.mount(message.fileTree)
                }
                if (message.fileTree) {
                    setFileTree(message.fileTree || {})
                }
                setMessages(prevMessages => {
                    const isDuplicate = prevMessages.some(msg => 
                        msg.sender._id === 'ai' && msg.message === data.message
                    );
                    return isDuplicate ? prevMessages : [...prevMessages, data];
                });
            } else if (data.sender._id !== user._id) {
                setMessages(prevMessages => {
                    const isDuplicate = prevMessages.some(msg => 
                        msg.sender._id === data.sender._id && 
                        msg.message === data.message &&
                        msg.timestamp === data.timestamp
                    );
                    return isDuplicate ? prevMessages : [...prevMessages, data];
                });
            }
        });

        const fetchData = async () => {
            try {
                const projectRes = await apiConnector(
                    "GET",
                    `http://localhost:4000/projects/get-project/${location.state.project._id}`,
                    null,
                    {
                        Authorization: `Bearer ${token}`,
                    }
                );
                setProject(projectRes.data.project);
                if (projectRes.data.project.fileTree) {
                    setFileTree(projectRes.data.project.fileTree);
                }

                const usersRes = await apiConnector(
                    "GET",
                    `http://localhost:4000/projects/allUsers`,
                    null,
                    {
                        Authorization: `Bearer ${token}`,
                    }
                );
                setUsers(usersRes.data.users);
            } catch (err) {
                console.log(err);
            }
        };

        fetchData();

        return () => {
            if (runProcess) {
                runProcess.kill();
            }
        };
    }, []);

    useEffect(() => {
        // Apply syntax highlighting to all code blocks initially
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }, [currentFile, fileTree]); // Re-run when file or file tree changes

    function scrollToBottom() {
        messageBox.current.scrollTop = messageBox.current.scrollHeight
    }

    return (
        <main className='h-[1020px] w-screen flex'>
            <section className="left relative flex flex-col h-[1020px ] min-w-96 bg-slate-300">
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0'>
                    <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i>
                        <p>Add collaborator</p>
                    </button>
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>
                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative">
                    <div
                        ref={messageBox}
                        className="message-box p-1 flex-grow flex flex-col gap-1 overflow-auto max-h-full scrollbar-hide">
                        {messages.map((msg, index) => (
                            <div key={index} className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} ${msg.sender._id == user._id.toString() && 'ml-auto'}  message flex flex-col p-2 bg-slate-50 w-fit rounded-md`}>
                                <small className='opacity-65 text-xs'>{msg.sender.email}</small>
                                <div className='text-[15px]'>
                                    {msg.sender._id === 'ai' ?
                                        WriteAiMessage(msg.message)
                                        : <p>{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="inputField w-full flex absolute bottom-0">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                            className='p-2 px-4 border-none outline-none flex-grow bg-white' 
                            type="text" 
                            placeholder='Enter message' 
                        />
                        <button
                            onClick={send}
                            className='px-5 bg-slate-950 text-white py-2.5'>
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>
                        <h1 className='font-semibold text-lg'>Collaborators</h1>
                        <button onClick={() => setIsSidePanelOpen(false)} className='p-2'>
                            <i className="ri-close-line"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2 p-4 overflow-y-auto">
                        {project.users && project.users.map((user, index) => (
                            <div key={index} className="user cursor-pointer hover:bg-slate-100 p-3 flex gap-3 items-center rounded-lg transition-colors">
                                <div className='aspect-square rounded-full w-10 h-10 flex items-center justify-center text-white bg-slate-600 relative'>
                                    <i className="ri-user-fill text-lg"></i>
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <h1 className='font-semibold text-gray-800 truncate'>{user.firstName}</h1>
                                    <p className='text-sm text-gray-500 truncate'>{user.email}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="right bg-red-50 flex-grow h-full flex">
                <div className="explorer h-full max-w-64 min-w-52 bg-slate-200">
                    <div className="file-tree w-full">
                        {Object.keys(fileTree || {}).map((file, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentFile(file)
                                    setOpenFiles([...new Set([...openFiles, file])])
                                }}
                                className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-300 w-full">
                                <p className='font-semibold text-lg'>{file}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="code-editor flex flex-col flex-grow h-full shrink">
                    <div className="top flex justify-between w-full">
                        <div className="files flex">
                            {openFiles.map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentFile(file)}
                                    className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`}>
                                    <p className='font-semibold text-lg'>{file}</p>
                                </button>
                            ))}
                        </div>
                        <div className="actions flex gap-2">
                            <button
                                onClick={async () => {
                                    await webContainer.mount(fileTree)
                                    const installProcess = await webContainer.spawn("npm", [ "install" ])
                                    installProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk)
                                        }
                                    }))

                                    if (runProcess) {
                                        await runProcess.kill()
                                    }

                                    let tempRunProcess = await webContainer.spawn("npm", [ "start" ]);
                                    tempRunProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk)
                                        }
                                    }))

                                    setRunProcess(tempRunProcess)
                                    
                                    webContainer.on('server-ready', (port, url) => {
                                        console.log("server ready");
                                        console.log(port, url)
                                        setIframeUrl(url)
                                    })
                                }}
                                className='p-2 px-4 bg-slate-300 text-white'
                            >
                                run
                            </button>
                        </div>
                    </div>
                    <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                        {fileTree[currentFile] && (
                            <div className="code-editor-area h-full overflow-auto flex-grow bg-slate-950">
                                <pre className="hljs h-full">
                                    <code
                                        className={`language-${currentFile.split('.').pop() || 'plaintext'} h-full outline-none`}
                                        contentEditable
                                        spellCheck="false"
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const updatedContent = e.target.innerText;
                                            const ft = {
                                                ...fileTree,
                                                [currentFile]: {
                                                    file: {
                                                        contents: updatedContent
                                                    }
                                                }
                                            }
                                            setFileTree(ft)
                                            // Reapply syntax highlighting after edit
                                            hljs.highlightElement(e.target);
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: hljs.highlight(
                                                fileTree[currentFile].file.contents,
                                                { language: currentFile.split('.').pop() || 'plaintext' }
                                            ).value
                                        }}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            paddingBottom: '25rem',
                                            padding: '1rem',
                                            fontFamily: 'monospace',
                                            fontSize: '1.1rem'
                                        }}
                                    />
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                {iframeUrl && webContainer && (
                    <div className="flex min-w-96 flex-col h-full">
                        <div className="address-bar">
                            <input type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl} className="w-full p-2 px-4 bg-slate-200" />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full"></iframe>
                    </div>
                )}
            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-auto">
                            {users.map(user => (
                                <div key={user.id} className={`user cursor-pointer hover:bg-slate-200 ${Array.from(selectedUserId).indexOf(user._id) != -1 ? 'bg-slate-200' : ""} p-2 flex gap-2 items-center`} onClick={() => handleUserClick(user._id)}>
                                    <div className='aspect-square relative rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.firstName}</h1>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project