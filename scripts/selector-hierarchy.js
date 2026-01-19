
/*

Can be used as simple debugging tool for CSS styling..

1. Paste into Obsidian Developer Console.
2. Click target.
3. Look at the Console: You will see a visual tree map.
4. The CSS selector and Hierarchy Tree is automatically copied to clipboard.


```example-clipboard
div.view-header-title-container > div.view-header-title

div.workspace-leaf-content
├── div.view-header
│   ├── div.view-header-icon
│   ├── div.view-header-title-container
│   │   ├── div.view-header-title ("Start Here")  ⬅️ 🎯 SELECTED
│   │   └── div.view-header-title-parent
│   └── div.view-actions
└── div.view-content
```
*/

(function enableObsidianInspectorV4() {
    console.clear();
    const LOG_STYLE = "background: #4a148c; color: #e1bee7; font-size: 14px; padding: 4px; border-radius: 4px;";
    console.log("%c 🌳 OBSIDIAN DOM TREE INSPECTOR ", LOG_STYLE);
    console.log("Hover and CLICK. The Selector AND Tree will be copied to clipboard.");

    let lastEl = null;
    let oldOutline = '';
    let oldOffset = '';

    const restoreStyles = () => {
        if (lastEl) {
            lastEl.style.outline = oldOutline;
            lastEl.style.outlineOffset = oldOffset;
        }
    };

    const cleanStr = (str) => (str || '').replace(/\s+/g, ' ').trim().substring(0, 40);

    const getTagAndClass = (el) => {
        if (!el) return '';
        let str = el.tagName.toLowerCase();
        if (el.id) str += `#${el.id}`;
        const validClasses = Array.from(el.classList)
            .filter(c => !['is-active', 'is-focused', 'has-focus', 'is-selected'].includes(c));
        if (validClasses.length) str += `.${validClasses.join('.')}`;
        return str;
    };

    const getIdentity = (el) => {
        const desc = getTagAndClass(el);
        // Grab content hint, ensuring we don't grab massive text blocks
        let hint = el.getAttribute('aria-label') || el.title;
        // If no attribute hint, try first text node
        if (!hint && el.childNodes.length > 0) {
            for (let node of el.childNodes) {
                if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                    hint = node.textContent;
                    break;
                }
            }
        }
        return (hint) ? `${desc} ("${cleanStr(hint)}")` : desc;
    };

    const generateTree = (target) => {
        let output = [];
        
        // Context: Go up to 2 parents
        let root = target.parentElement;
        if (root && root.parentElement && root.parentElement.tagName !== 'BODY') {
            root = root.parentElement;
        }
        if(!root) root = target;

        const traverse = (node, prefix, isLast) => {
            const isTarget = node === target;
            const isParentOfTarget = node.contains(target) && node !== target;
            
            const connector = isLast ? "└── " : "├── ";
            let line = `${prefix}${connector}${getIdentity(node)}`;

            if (isTarget) line += "  ⬅️ 🎯 SELECTED";
            output.push(line);
            
            // Only dive deeper if it is the target (show immediate children) 
            // or if it contains the target (show path to target)
            if (isTarget || isParentOfTarget) {
                const children = Array.from(node.children);
                children.forEach((child, index) => {
                    const childIsLast = index === children.length - 1;
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    traverse(child, newPrefix, childIsLast);
                });
            }
        };

        output.push(getIdentity(root)); // Root
        const children = Array.from(root.children);
        children.forEach((child, index) => {
            traverse(child, "", index === children.length - 1);
        });

        return output.join('\n');
    };

    const onMouseOver = (e) => {
        if (lastEl !== e.target) {
            restoreStyles();
            lastEl = e.target;
            oldOutline = lastEl.style.outline;
            oldOffset = lastEl.style.outlineOffset;
            lastEl.style.outline = '2px solid #d08770'; 
            lastEl.style.outlineOffset = '-2px';
        }
    };

    const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        restoreStyles();
        
        const target = e.target;
        document.removeEventListener('mouseover', onMouseOver, true);
        document.removeEventListener('click', onClick, true);

        // 1. Generate Data
        const parent = target.parentElement;
        const selector = parent 
            ? `${getTagAndClass(parent)} > ${getTagAndClass(target)}`
            : getTagAndClass(target);
        
        const treeMap = generateTree(target);
        
        // 2. Prepare Clipboard Content
        const clipboardContent = `${selector}\n\n${treeMap}`;

        // 3. Log to Console
        console.group(`%c 🎯 DOM CAPTURE `, "color: #a3be8c; font-size: 14px;");
        console.log(`%cCSS Selector:`, "color: #ebcb8b; font-weight: bold;");
        console.log(selector);
        console.log(`%cHierarchy:`, "color: #88c0d0; font-weight: bold;");
        console.log(`%c${treeMap}`, "line-height: 1.4; font-family: monospace; color: #e5e9f0;");
        console.groupEnd();

        // 4. Copy
        navigator.clipboard.writeText(clipboardContent)
            .then(() => console.log("%c✅ Selector + Tree copied to clipboard!", "color: #a3be8c"))
            .catch(err => console.error("Copy failed", err));
    };

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
})();