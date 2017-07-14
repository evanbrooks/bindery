import elementName from "./ElementName"
import Page from "./Page/page";

export default function(content, rules, done, DELAY) {

  let state = {
    path: [], // Stack representing which element we're currently inside
    pages: [],
    getNewPage: () => { // Gross hack to allow rules to advance to next page
      return makeNextPage();
    }
  }

  let throttle = (func) => {
    if (DELAY > 0) setTimeout(func, DELAY);
    else func();
  }

  let beforeAddRules = (elmt) => {
    rules.forEach( (rule) => {
      if (elmt.matches(rule.selector) && rule.beforeAdd) {

        let backupPg = state.currentPage.clone();
        let backupElmt = elmt.cloneNode(true);
        rule.beforeAdd(elmt, state);

        if (state.currentPage.hasOverflowed()) {
          // restore from backup
          elmt.innerHTML = backupElmt.innerHTML; // TODO: make less hacky

          let idx = state.pages.indexOf(state.currentPage);
          state.pages[idx] = backupPg;
          state.currentPage = backupPg;

          state.currentPage = makeNextPage();

          rule.beforeAdd(elmt, state);
        }
      }
    });
  }
  let afterAddRules = (elmt) => {
    rules.forEach( (rule) => {
      if (elmt.matches(rule.selector) && rule.afterAdd) {
        rule.afterAdd(elmt, state);
      }
    });
  }
  let newPageRules = (pg) => {
    rules.forEach( (rule) => {
      if (rule.newPage) rule.newPage(pg, state);
    });
  }
  let afterBindRules = (pages) => {
    rules.forEach( (rule) => {
      if (rule.afterBind) {
        pages.forEach((pg, i) => {
          rule.afterBind(pg, i);
        });
      }
    });
  }

  // Creates clones for ever level of tag
  // we were in when we overflowed the last page
  let makeNextPage = () => {
    state.path = clonePath(state.path);
    let newPage = new Page();
    newPageRules(newPage);
    state.pages.push(newPage);
    state.currentPage = newPage; // TODO redundant
    if (state.path[0]) {
      newPage.flowContent.appendChild(state.path[0]);
    }
    return newPage;
  };

  let moveNodeToNextPage = (nodeToMove) => {
    state.path.pop();

    let fn = state.currentPage.footer.lastChild; // <--
    state.currentPage = makeNextPage();
    if (fn) state.currentPage.footer.appendChild(fn); // <-- move footnote to new page

    last(state.path).appendChild(nodeToMove);
    state.path.push(nodeToMove);
  }

  // Adds an text node by binary searching amount of
  // words until it just barely doesnt overflow
  let addTextNode = (node, doneCallback, abortCallback) => {

    last(state.path).appendChild(node);

    let textNode = node;
    let origText = textNode.nodeValue;

    let lastPos = 0;
    let pos = origText.length/2;;

    let step = () => {

      let dist = Math.abs(lastPos - pos);

      if (pos > origText.length - 1) {
        throttle(doneCallback);
        return;
      }
      textNode.nodeValue = origText.substr(0, pos);

      if (dist < 1) { // Is done

        // Back out to word boundary
        while(origText.charAt(pos) !== " " && pos > -1) pos--;

        if (pos < 1 && origText.trim().length > 0) {
          // console.error(`Bindery: Aborted adding "${origText.substr(0,25)}"`);
          textNode.nodeValue = origText;
          abortCallback();
          return;
        }

        textNode.nodeValue = origText.substr(0, pos);

        origText = origText.substr(pos);
        pos = 0;

        // Start on new page
        state.currentPage = makeNextPage();
        textNode = document.createTextNode(origText);
        last(state.path).appendChild(textNode);

        // If the remainder fits there, we're done
        if (!state.currentPage.hasOverflowed()) {
          throttle(doneCallback);
          return;
        }
      }
      lastPos = pos;

      let hasOverflowed = state.currentPage.hasOverflowed();
      pos = pos + (hasOverflowed ? -dist : dist) / 2;

      throttle(step);
    }

    if (state.currentPage.hasOverflowed()) {
      step(); // find breakpoint
    }
    else throttle(doneCallback); // add in one go
  }


  // Adds an element node by clearing its childNodes, then inserting them
  // one by one recursively until thet overflow the page
  let addElementNode = (node, doneCallback) => {

    // Add this node to the current page or context
    if (state.path.length == 0) {
      state.currentPage.flowContent.appendChild(node);
    }
    else {
      last(state.path).appendChild(node);
    }
    state.path.push(node);

    // Clear this node, before re-adding its children
    let childNodes = [...node.childNodes];
    node.innerHTML = '';

    let index = 0;
    let addNextChild = () => {
      if (!(index < childNodes.length)) {
        doneCallback();
        return;
      }
      let child = childNodes[index];
      index += 1;
      switch (child.nodeType) {
        case Node.TEXT_NODE:
          let cancel = () => {
            moveNodeToNextPage(node);
            addTextNode(child, addNextChild, cancel);
          }
          addTextNode(child, addNextChild, cancel);
          break;
        case Node.ELEMENT_NODE: {
          if (child.tagName == "SCRIPT") {
            addNextChild(); // skip
            break;
          }

          beforeAddRules(child);

          throttle(() => {
            addElementNode(child, () => {
              let addedChild = state.path.pop();
              afterAddRules(addedChild);  // TODO: AfterAdd rules may want to access original child, not split second half
              addNextChild();
            })
          });
          break;
        }
        default:
          console.log(`Bindery: Unknown node type: ${child.nodeType}`);
      }
    }

    // kick it off
    addNextChild();
  }

  state.currentPage = makeNextPage();
  content.style.margin = 0;
  content.style.padding = 0;

  addElementNode(content, () => {
    console.log(`Bindery: Pages created in ${2}ms`);
    let measureArea = document.querySelector(".bindery-measure-area");
    document.body.removeChild(measureArea);

    let orderedPage = reorderPages(state.pages);

    afterBindRules(orderedPage);

    done(orderedPage);
  });
}

let last = (arr) => arr[arr.length-1];

let clonePath = (origPath) => {
  let newPath = [];
  for (var i = origPath.length - 1; i >= 0; i--) {
    let clone = origPath[i].cloneNode(false);
    clone.innerHTML = '';
    clone.setAttribute("bindery-continuation", true);
    if (clone.id) {
      console.warn(`Bindery: Added a break to ${elementName(clone)}, so "${clone.id}" is no longer a unique ID.`);
    }
    if (i < origPath.length - 1) clone.appendChild(newPath[i+1]);
    newPath[i] = clone;
  }
  return newPath;
}

// TODO: only do this if not double sided?
let reorderPages = (pages) => {
  // TODO: this ignores the cover page, assuming its on the right
  for (var i = 1; i < pages.length - 1; i += 2) {
    let left  = pages[i];

    // TODO: Check more than once
    if (left.alwaysRight) {
      if (left.outOfFlow) {
        pages[i] = pages[i+1];
        pages[i+1] = left;
      }
      else {
        pages.splice(i, 0, new Page());
      }
    }

    let right = pages[i+1];

    if (right.alwaysLeft) {
      if (right.outOfFlow) {
        // TODO: don't overflow, assumes that
        // there are not multiple spreads in a row
        pages[i+1] = pages[i+3];
        pages[i+3] = right;
      }
      else {
        pages.splice(i+1, 0, new Page());
      }
    }
  }

  return pages;
}
