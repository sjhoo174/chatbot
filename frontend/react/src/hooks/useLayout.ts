

export const handleResize = () => {
    useLayout()
}

export function useLayout() {
    const rootFontSize = 100
    const baseHeight = 640
    const baseWidth = 1280
    const heightRatio = window.innerHeight / baseHeight
    const widthRatio = window.innerWidth / baseWidth
    const minRatio = Math.min(heightRatio, widthRatio) 
    document.documentElement.style.fontSize = `${Math.max(minRatio*rootFontSize, 50)}px`;  // Set font size for the entire HTML documen
}