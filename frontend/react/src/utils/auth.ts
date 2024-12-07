

export function getCookie(name) {
    const value = `; ${document.cookie}`;
    console.log(value)
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const popped = parts.pop()
        if (popped)
            popped.split(';').shift();
            return popped
    }
    return null;
}

export function deleteCookie(name) {
    // Set the cookie's expiration date to a past date, effectively deleting it
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

export function removeQueryParam(param) {
    const url = new URL(window.location.href);  // Get the current URL
    const params = new URLSearchParams(url.search);  // Extract the query parameters
    // Delete the specified parameter
    params.delete(param);
    // Update the URL in the browser without reloading the page
    window.history.replaceState({}, '', `${url.pathname}?${params.toString()}`);
}