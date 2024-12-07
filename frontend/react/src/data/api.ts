


export const getEmail = async() => {
    return await fetch(`${import.meta.env.VITE_API_URL}/email`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("TOKEN")}`
        },
    }).then((response) => {
        return response.json()
    }).then((data) => {
        return data
    }).catch((error) => {
        return Promise.reject(error)
    })
}



export const fetchConversations = async () => {
    return await fetch(`${import.meta.env.VITE_API_URL}/conversations`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("TOKEN")}`
        },
    }).then((response) => {
        return response.json()
    }).then((data) => {
        return data
    }).catch((error) => {
        return Promise.reject(error)
    })
}