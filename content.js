(() => {
  const ASSETS = {
    x: chrome.runtime.getURL("assets/x.com.jpg"),
    youtube: chrome.runtime.getURL("assets/youtube.com.jpg")
  };

  const X = {
    handles: new Set(["theo", "t3dotgg"]),
    profileImageKeys: [
      "EeSGdgA5",
      "VVPe1CP0",
      "/profile_images/1909353910130950147/",
      "/profile_images/1840190186245746688/"
    ]
  };

  const YOUTUBE = {
    handles: new Set(["@t3dotgg", "@theo"]),
    profileImageKeys: [
      "Y6jut5A-dhWRlv7W81kGxVFPtZGjZN97IhBP75uLnx2AVV7ZEJUUUxBKHlFw9GcwILxkz1E_cLc"
    ]
  };

  const TWITCH = {
    profileImageKeys: [
      "a7f1c81b-6f00-41fc-8da9-18aabf169e75-profile_image-70x70.png"
    ]
  };

  const isX = /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(location.hostname);
  const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
  const isTwitch = /(^|\.)twitch\.tv$/.test(location.hostname);

  function imageUrl(img) {
    return img.currentSrc || img.src || img.getAttribute("src") || "";
  }

  function sameUrl(url, replacement) {
    return url === replacement || url.startsWith(`${replacement}?`);
  }

  function closestAnchorUrl(element) {
    const anchor = element.closest("a[href]");
    if (!anchor) return "";

    try {
      return new URL(anchor.getAttribute("href"), location.href).href;
    } catch {
      return "";
    }
  }

  function pathParts(url) {
    try {
      return new URL(url).pathname.split("/").filter(Boolean);
    } catch {
      return [];
    }
  }

  function normalizedXHandle(part) {
    return (part || "").replace(/^@/, "").toLowerCase();
  }

  function hasXHandleLink(img) {
    const parts = pathParts(closestAnchorUrl(img));
    const [handle, subpage] = parts;

    return X.handles.has(normalizedXHandle(handle)) &&
      (parts.length === 1 || (parts.length === 2 && subpage.toLowerCase() === "photo"));
  }

  function hasYouTubeHandleLink(img) {
    const parts = pathParts(closestAnchorUrl(img));
    return parts.some((part) => YOUTUBE.handles.has(part.toLowerCase()));
  }

  function hasTheoTextNearby(img) {
    const container = img.closest(
      "ytd-video-owner-renderer, ytd-channel-renderer, ytd-compact-video-renderer, ytd-rich-grid-media, ytd-watch-metadata"
    );

    return /\bTheo\b|t3[.\u2024]?gg|t3dotgg/i.test(container?.innerText || "");
  }

  function isProbablyAvatar(img) {
    const src = imageUrl(img);
    const { width, height } = img.getBoundingClientRect();
    const maxSide = Math.max(width, height);

    if (src.includes("/profile_banners/")) return false;
    if (src.includes("/media/") || src.includes("/amplify_video_thumb/")) return false;
    if (src.includes("/profile_images/")) return true;
    if (/yt3\.(ggpht|googleusercontent)\.com/.test(src)) return true;
    if (maxSide > 0 && maxSide <= 220 && Math.abs(width - height) <= 8) return true;

    return false;
  }

  function shouldReplaceX(img) {
    const src = imageUrl(img);
    if (!src || sameUrl(src, ASSETS.x)) return false;
    if (X.profileImageKeys.some((key) => src.includes(key))) return false;

    return hasXHandleLink(img) && isProbablyAvatar(img);
  }

  function shouldReplaceYouTube(img) {
    const src = imageUrl(img);
    if (!src || sameUrl(src, ASSETS.youtube)) return false;
    if (YOUTUBE.profileImageKeys.some((key) => src.includes(key))) return false;

    return hasYouTubeHandleLink(img) && hasTheoTextNearby(img) && isProbablyAvatar(img);
  }

  function shouldReplaceTwitch(img) {
    const src = imageUrl(img);
    if (!src || sameUrl(src, ASSETS.youtube)) return false;

    return TWITCH.profileImageKeys.some((key) => src.includes(key));
  }

  function replaceImage(img, replacement) {
    if (imageUrl(img) === replacement) return;

    img.dataset.realtheoOriginalSrc ||= imageUrl(img);
    img.removeAttribute("srcset");
    img.removeAttribute("data-src");
    img.removeAttribute("data-thumb");
    img.srcset = "";
    img.src = replacement;
  }

  function processImage(img) {
    if (!(img instanceof HTMLImageElement)) return;

    if (isX && shouldReplaceX(img)) {
      replaceImage(img, ASSETS.x);
      return;
    }

    if (isYouTube && shouldReplaceYouTube(img)) {
      replaceImage(img, ASSETS.youtube);
      return;
    }

    if (isTwitch && shouldReplaceTwitch(img)) {
      replaceImage(img, ASSETS.youtube);
    }
  }

  function processBackground(element) {
    if (!isX || !(element instanceof HTMLElement)) return;

    const style = getComputedStyle(element);
    const match = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (!match) return;

    const src = match[1];
    const hasTheoImage = X.profileImageKeys.some((key) => src.includes(key));
    if (hasTheoImage) return;
    if (!hasXHandleLink(element)) return;
    if (!src.includes("/profile_images/")) return;

    element.dataset.realtheoOriginalBackground ||= element.style.backgroundImage || style.backgroundImage;
    element.style.backgroundImage = `url("${ASSETS.x}")`;
  }

  function processRoot(root = document) {
    if (root instanceof HTMLImageElement) {
      processImage(root);
      return;
    }

    root.querySelectorAll?.("img").forEach(processImage);
    root.querySelectorAll?.("[style*='background-image']").forEach(processBackground);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        processImage(mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) processRoot(node);
      }
    }
  });

  function start() {
    processRoot();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "data-src", "data-thumb", "style"]
    });
  }

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
