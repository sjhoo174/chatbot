import React,{
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import { BiSend, BiSolidUserCircle, BiRefresh } from 'react-icons/bi';
import { MdOutlineArrowLeft, MdOutlineArrowRight } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { setChats, setEmail, setLogin } from './store';
import { useSelector, useDispatch } from 'react-redux';
import { fetchConversations, getEmail } from './data/api';
import { handleResize } from './hooks/useLayout';

function App() {
  const navigate = useNavigate()
  const chats = useSelector((state : any) => state.chats.chats)
  const email = useSelector((state: any) => state.login.email)
  const loggedIn = useSelector((state: any) => state.login.status)

  const dispatch = useDispatch()

  const [text, setText] = useState('');
  const [isVisible, setIsVisible] = useState<boolean[]>([]);
  const [logoutButton, setLogoutButton] = useState(false);
  const [isResponseLoading, setIsResponseLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isShowSidebar, setIsShowSidebar] = useState(false);
  const scrollRefs = useRef<(HTMLLIElement | null)[]>([]);

  const ROLE_USER = 'user'

  const refresh = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/conversations`, {
      method: 'DELETE',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("TOKEN")}`
      },
  }).then((response) => {
      return response.json()
  }).then((_) => {
    setText('');
    dispatch(setChats([]))
  }).catch((error) => {
      console.log(error)
  })
  }; 

  const handleLogout = async () => {
    localStorage.removeItem("TOKEN")  
    dispatch(setLogin(false))
    navigate("/")
  }

  const toggleSidebar = useCallback(() => {
    setIsShowSidebar((prev) => !prev);
  }, []);

  const askGPT = async (query: string) => {
      // const responseMessage = {
      //   role: ROLE_ASSISTANT,
      //   content: Array(1000).fill("f").join(""),
      // };
    const controller = new AbortController();
    const _ = setTimeout(() => controller.abort(), 20000); 

    // const params = new URLSearchParams({
    //   prompt_content: query
    // });
    
    await fetch(
      `${import.meta.env.VITE_API_URL}/prompt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("TOKEN")}`
        },
        signal: controller.signal,
        body: JSON.stringify({ messages: [{"role" : ROLE_USER, "content": query }]}),  // Include messages as payload
      },
    ).then((response) => {
      if (!response.ok) {
        return Promise.reject('Error status: ${response.status}');
      } 
      return response.json()
    }).then((data) => {
      if (data.error) {
        return Promise.reject(data.error)
      } else {
        setErrorText("");
        const newChats = [...chats, data[data.length-1]]
        dispatch(setChats(newChats));

        setIsResponseLoading(false);
      }
    }).catch((error) => {
      setErrorText(error.message)
      setTimeout(() => {
        setErrorText("")
        setIsResponseLoading(false)
      }, 3000)
    })
  }


  const submitHandler = async (e) => {
    e.preventDefault();
    // return setErrorText('*Prompt is too long, please revise it.');

    const myMessage = {
      role: ROLE_USER,
      content: text
    }
    setText('') 

    const updatedChats = [...chats, myMessage];
    dispatch(setChats(updatedChats));
    setIsResponseLoading(true);
  };

  useLayoutEffect(() => {
    const handleResize = () => {
      setIsShowSidebar(window.innerWidth <= 640);
    };
    handleResize();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const updateVisible = (i) => {
    setIsVisible((prevState) => {
      const newState = prevState.map((v, idx) => {
        if (idx === i) {
          return true
        }
        return v
      })
      return newState
    }
    )
  }


  useEffect(() => {
    window.removeEventListener("resize", handleResize)
    document.documentElement.style.fontSize = "initial"
    const token = localStorage.getItem("TOKEN")
    if (token) {
      if (!loggedIn) {
        getEmail().then((data) => {
            dispatch(setEmail(data["email"]))
        }).then(async () => {
          await fetchConversations().then((data) => {
              dispatch(setChats(data["messages"]))
              return
          }).catch(error => {
              return Promise.reject(error)
          })
        }).catch((error) => {
            console.log(error)
            navigate("/")
            return
        })
      } else {
        fetchConversations().then((data) => {
            dispatch(setChats(data["messages"]))
            return
        }).catch(error => {
            console.log(error)
            navigate("/")
            return
        })
      } 
    } else {
      navigate("/")
      return
    }

    const handlePopstate = () => {
        handleLogout()
    };

    // Add event listener
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      console.log("app unmounted")
    };  
  }, [])

  useLayoutEffect(() => {
    if (chats.length) {
      const latestChat = chats[chats.length-1]
      if (latestChat.role === ROLE_USER) {
        askGPT(latestChat.content)      
      }
    }

    setIsVisible((prev) => {
      if (prev.length < chats.length) {
        const newState = [...prev]
        for (let i = 1 ; i <= chats.length - prev.length; i++) {
          newState.push(false)
        }
        return newState
      }
      return prev
    })
    const rootElement = document.querySelector('.main-header'); // Select the root element

    const observer = new IntersectionObserver(
      ([entry]) => {
        const idx = scrollRefs.current.indexOf(entry.target as HTMLLIElement)
        if (entry.isIntersecting) {
          updateVisible(idx)
        }
      },
      {
        root: rootElement,
        threshold: 0.1, // Trigger when 50% of the element is in view
      }
    );
    scrollRefs.current.forEach((ref) => {
      if (ref)
        observer.observe(ref as Element);
    })

    
    scrollRefs.current[scrollRefs.current.length-2]?.scrollIntoView({
      behavior: "instant"
    })

    const mostBottomScrollRef = scrollRefs.current.reduce((prev, curr, _) => {
        if (curr) {
          if (prev) {
            if (curr.getBoundingClientRect().bottom > prev.getBoundingClientRect().bottom) {
              return curr
            } else {
              return prev
            }
          }
          return curr
        }
        return prev
      }, scrollRefs.current[0]
    )

    scrollRefs.current.forEach((ref, idx) => {
      if (ref) {
        const rect = ref.getBoundingClientRect()
        const parent = ref.parentNode
        let parentParent : HTMLElement | null = null
        if (parent) {
          parentParent = parent.parentElement
        }
        if (parentParent && mostBottomScrollRef) {
          if (Math.abs(rect.bottom - mostBottomScrollRef.getBoundingClientRect().bottom) < parentParent.offsetHeight)
            updateVisible(idx)
        }
      }
    });


  }, [chats])

  return (
    <>
      <div className='container' onClick={() => setLogoutButton(false)}>
        <section className={`sidebar ${isShowSidebar ? 'open' : ''}`}>
          <button className='sidebar-header' onClick={refresh} role='button'>
            <BiRefresh size={20} />
            Refresh Chat
          </button>
          <div className='sidebar-history'>
            <>
              <p>Developer - Hoo Shi Jan</p>
              <p>
              For opportunities, kindly contact him at the following channels.
              </p>
              <p>Email: shijanhoo@gmail.com</p>
              <div className='linkedin-container'>
                <p>Linkedin: </p> 
                <a className='linkedin-button' href='https://www.linkedin.com/in/hoo-shi-jan-634057164/'>
                  <img
                    src='/assets/images/linkedin.png'/>
                </a>
              </div>
              
            </>
          </div>
          <div className='sidebar-info'>
            <div className='sign-in'>You are signed in as</div>
            {logoutButton && <div className="logout" onClick={handleLogout}>Logout</div>}
            <div className='sidebar-info-user' onClick={(e) => {
              e.stopPropagation()
              setLogoutButton((prev) => !prev)
            }}>
              <BiSolidUserCircle size={20} />
              <p>{email}</p>
            </div>
          </div>
        </section>

        <section className='main'>
          <div className='top-container'>
            <img
              src='/assets/images/logo.jpeg'
              width={45}
              height={45}
              alt='Shi Jan'
            />
            <div className="title">Shi Jan's Chatbot</div>
            <div className='message'>How can I help you today?</div>
          </div>

          {isShowSidebar ? (
            <MdOutlineArrowRight
              className='burger'
              size={28.8}
              onClick={toggleSidebar}
            />
          ) : (
            <MdOutlineArrowLeft
              className='burger'
              size={28.8}
              onClick={toggleSidebar}
            />
          )}
          <div className='main-header'>
            <ul>
              {chats.map((chatMsg, idx) => {
                const isUser = chatMsg.role === ROLE_USER;

                return (
                  <li key={idx} ref={(el) => scrollRefs.current[idx] = el} className={`${isVisible[idx] ? 'visible': '' } ${idx%2===0 ? 'even': 'odd'}`}>
                    {isUser ? (
                      <div className='chat-left-container'>
                        <div className='chat-icon'>
                          <BiSolidUserCircle size={28.8} />
                        </div>
                      </div>
                    ) : (
                      <div className='chat-left-container'>
                        <img src='/assets/images/logo.jpeg' alt='Shi Jan' className='chat-icon'/>
                      </div>
                    )}
                    {isUser ? (
                      <div className='role-container'>
                        <p className='role-title'>You</p>
                        <p dangerouslySetInnerHTML={{__html: chatMsg.content}}></p>
                      </div>
                    ) : (
                      <div className='role-container'>
                        <p className='role-title'>Chatbot</p>
                        <p dangerouslySetInnerHTML={{__html: chatMsg.content}}></p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className='main-bottom'>
            {isResponseLoading && <div className="loading">
              <div />
              <div />
              <div />
            </div>}
            {errorText && <p className='error-text'>{errorText}</p>}
            <form className='form-container' onSubmit={submitHandler}>
              <input
                id="message"
                type='text'
                placeholder='Send a message.'
                spellCheck='false'
                value={isResponseLoading ? 'Processing...' : text}
                onChange={(e) => setText(e.target.value)}
                readOnly={isResponseLoading}
              />
              {!isResponseLoading && (
                <button type='submit'>
                  <BiSend size={20} />
                </button>
              )}
            </form>
            <p>
              Responses are powered by OpenAI GPT-4o-mini model.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default App;
