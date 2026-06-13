// whiteboard.js

let canvas = null;
let currentActiveProblem = null;
let currentMode = 'draw'; 
let isDragging = false;
let lastPosX, lastPosY;
let _clipboard = null; 

// ─── SHAPE DRAWING STATE ───
let isDrawingShape = false;
let shapeStart = { x: 0, y: 0 };
let currentShape = null;

function initCanvas() {
  if (canvas) return; 
  
  const container = document.getElementById('wb-container');
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  
  const canvasEl = document.getElementById('wb-canvas');
  canvasEl.width = cw; 
  canvasEl.height = ch;

  canvas = new fabric.Canvas('wb-canvas', {
    isDrawingMode: true,
    width: cw, height: ch,
    selection: false 
  });
  
  canvas.freeDrawingBrush.color = '#10b981'; 
  canvas.freeDrawingBrush.width = 4;

  // 1. ZOOM
  canvas.on('mouse:wheel', function(opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 10) zoom = 10;
    if (zoom < 0.1) zoom = 0.1;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
  });

  // 2. MOUSE DOWN (Start Drawing Shapes, Erasing, or Panning)
  canvas.on('mouse:down', function(opt) {
    var evt = opt.e;
    let pointer = canvas.getPointer(opt.e);
    
    if (currentMode === 'erase' && opt.target) {
      canvas.remove(opt.target);
      canvas.requestRenderAll();
      return;
    }
    
    if (currentMode === 'pan') {
      isDragging = true;
      canvas.selection = false;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
      return;
    }

    // Begin drawing a shape
    if (currentMode.startsWith('shape-')) {
      isDrawingShape = true;
      shapeStart = { x: pointer.x, y: pointer.y };
      let color = canvas.freeDrawingBrush.color;

      // strokeUniform: true is the magic property that prevents weird stretching!
      let commonProps = {
        left: shapeStart.x, top: shapeStart.y,
        stroke: color, strokeWidth: 4, fill: 'transparent',
        strokeUniform: true, originX: 'left', originY: 'top',
        selectable: false, evented: false
      };

      if (currentMode === 'shape-line' || currentMode === 'shape-arrow' || currentMode === 'shape-divider') {
        currentShape = new fabric.Line([shapeStart.x, shapeStart.y, shapeStart.x, shapeStart.y], commonProps);
      } else if (currentMode === 'shape-rect') {
        currentShape = new fabric.Rect({ ...commonProps, width: 0, height: 0 });
      } else if (currentMode === 'shape-oval') {
        currentShape = new fabric.Ellipse({ ...commonProps, rx: 0, ry: 0 });
      } else if (currentMode === 'shape-triangle') {
        currentShape = new fabric.Triangle({ ...commonProps, width: 0, height: 0 });
      } else if (currentMode === 'shape-rhombus') {
        currentShape = new fabric.Polygon([{x: 0, y: 0}, {x: 0, y: 0}, {x: 0, y: 0}, {x: 0, y: 0}], commonProps);
      }

      if (currentShape) canvas.add(currentShape);
    }
  });

  // 3. MOUSE MOVE (Drag to size shapes, Swipe Erase, or Pan)
  canvas.on('mouse:move', function(opt) {
    if (currentMode === 'erase' && opt.e.buttons === 1 && opt.target) {
      canvas.remove(opt.target);
      canvas.requestRenderAll();
    }
    
    if (isDragging) {
      var e = opt.e;
      var vpt = this.viewportTransform;
      vpt[4] += e.clientX - lastPosX;
      vpt[5] += e.clientY - lastPosY;
      this.requestRenderAll();
      lastPosX = e.clientX;
      lastPosY = e.clientY;
    }

    // Dynamically size the shape as you drag your mouse
    if (isDrawingShape && currentShape) {
      let pointer = canvas.getPointer(opt.e);
      let w = Math.abs(pointer.x - shapeStart.x);
      let h = Math.abs(pointer.y - shapeStart.y);
      let newLeft = Math.min(pointer.x, shapeStart.x);
      let newTop = Math.min(pointer.y, shapeStart.y);

      if (currentMode === 'shape-line' || currentMode === 'shape-arrow') {
        currentShape.set({ x2: pointer.x, y2: pointer.y });
      } else if (currentMode === 'shape-divider') {
        currentShape.set({ x2: pointer.x, y2: shapeStart.y }); // Locks perfectly horizontal
      } else if (currentMode === 'shape-rect' || currentMode === 'shape-triangle') {
        currentShape.set({ width: w, height: h, left: newLeft, top: newTop });
      } else if (currentMode === 'shape-oval') {
        currentShape.set({ rx: w/2, ry: h/2, left: newLeft, top: newTop });
      } else if (currentMode === 'shape-rhombus') {
        currentShape.set({
          points: [{x: w/2, y: 0}, {x: w, y: h/2}, {x: w/2, y: h}, {x: 0, y: h/2}],
          width: w, height: h, left: newLeft, top: newTop
        });
      }
      canvas.requestRenderAll();
    }
  });

  // 4. MOUSE UP (Finish shape drawing)
  canvas.on('mouse:up', function(opt) {
    this.setViewportTransform(this.viewportTransform);
    isDragging = false;

    if (isDrawingShape && currentShape) {
      isDrawingShape = false;
      currentShape.set({ selectable: true, evented: true });
      
      // If it was an arrow, attach the arrow head!
      if (currentMode === 'shape-arrow') {
        let x1 = currentShape.x1, y1 = currentShape.y1;
        let x2 = currentShape.x2, y2 = currentShape.y2;
        let angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        let head = new fabric.Triangle({
          left: x2, top: y2, originX: 'center', originY: 'center',
          width: 15, height: 15, fill: currentShape.stroke,
          angle: angle + 90, selectable: false, evented: false
        });
        
        // Group the line and triangle together
        let group = new fabric.Group([currentShape, head], {
          selectable: true, evented: true, strokeUniform: true
        });
        canvas.remove(currentShape);
        canvas.add(group);
        currentShape = group;
      }

      currentShape.setCoords();
      canvas.setActiveObject(currentShape);
      setMode('select', document.getElementById('mode-select'));
      currentShape = null;
    }
  });

  setupToolbarListeners();
  setupKeyboardAndPaste();
}

function setupToolbarListeners() {
  // Modes
  document.getElementById('mode-draw').addEventListener('click', (e) => setMode('draw', e.target));
  document.getElementById('mode-erase').addEventListener('click', (e) => setMode('erase', e.target));
  document.getElementById('mode-select').addEventListener('click', (e) => setMode('select', e.target));
  document.getElementById('mode-pan').addEventListener('click', (e) => setMode('pan', e.target));

  // Text & Matrix (These still click-to-spawn because dragging text is weird)
  document.getElementById('add-text').addEventListener('click', (e) => spawnText('text', e.target));
  document.getElementById('add-matrix').addEventListener('click', (e) => spawnText('matrix', e.target));

  // Draggable Shapes
  document.getElementById('add-line').addEventListener('click', (e) => setMode('shape-line', e.target));
  document.getElementById('add-arrow').addEventListener('click', (e) => setMode('shape-arrow', e.target));
  document.getElementById('add-divider').addEventListener('click', (e) => setMode('shape-divider', e.target));
  document.getElementById('add-rect').addEventListener('click', (e) => setMode('shape-rect', e.target));
  document.getElementById('add-oval').addEventListener('click', (e) => setMode('shape-oval', e.target));
  document.getElementById('add-rhombus').addEventListener('click', (e) => setMode('shape-rhombus', e.target));
  document.getElementById('add-triangle').addEventListener('click', (e) => setMode('shape-triangle', e.target));

  // Colors
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
      const color = e.target.getAttribute('data-color');
      canvas.freeDrawingBrush.color = color;
      
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        if (activeObject.type === 'path' || activeObject.type === 'i-text' || activeObject.type === 'line') {
          activeObject.set({ stroke: color, fill: color });
        } else {
          activeObject.set({ stroke: color });
        }
        canvas.requestRenderAll();
      }
    });
  });

  // Brush Size
  document.getElementById('brush-size').addEventListener('input', (e) => {
    canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
  });
}

function spawnText(type, btnElement) {
  let color = canvas.freeDrawingBrush.color;
  let center = canvas.getVpCenter(); 
  let obj;

  document.querySelectorAll('.tool-icon').forEach(btn => btn.classList.remove('active'));
  btnElement.classList.add('active');

  if (type === 'text') {
    obj = new fabric.IText('Type here...', { left: center.x, top: center.y, fill: color, fontFamily: 'JetBrains Mono', fontSize: 24, originX: 'center', originY: 'center' });
  } else if (type === 'matrix') {
    obj = new fabric.IText("[\n  1  0  0\n  0  1  0\n  0  0  1\n]", { left: center.x, top: center.y, fill: color, fontFamily: 'JetBrains Mono', fontSize: 22, textAlign: 'center', originX: 'center', originY: 'center' });
  }

  canvas.add(obj);
  canvas.setActiveObject(obj);
  setMode('select', document.getElementById('mode-select'));
}

function setupKeyboardAndPaste() {
  window.addEventListener('keydown', (e) => {
    if (!document.getElementById('wb-modal').classList.contains('show')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || canvas.getActiveObject()?.isEditing) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length) {
        activeObjects.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const activeObject = canvas.getActiveObject();
      if (activeObject) activeObject.clone(function(cloned) { _clipboard = cloned; });
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (!_clipboard) return;
      _clipboard.clone(function(clonedObj) {
        canvas.discardActiveObject();
        clonedObj.set({ left: clonedObj.left + 20, top: clonedObj.top + 20, evented: true });
        if (clonedObj.type === 'activeSelection') {
          clonedObj.canvas = canvas;
          clonedObj.forEachObject(function(obj) { canvas.add(obj); });
          clonedObj.setCoords();
        } else {
          canvas.add(clonedObj);
        }
        _clipboard.top += 20; _clipboard.left += 20;
        canvas.setActiveObject(clonedObj);
        canvas.requestRenderAll();
      });
    }
  });

  window.addEventListener('paste', function(e) {
    if (!document.getElementById('wb-modal').classList.contains('show')) return;
    
    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      let item = items[index];
      if (item.kind === 'file') {
        let blob = item.getAsFile();
        let reader = new FileReader();
        reader.onload = function(event) {
          let imgObj = new Image();
          imgObj.src = event.target.result;
          imgObj.onload = function () {
            let image = new fabric.Image(imgObj);
            let center = canvas.getVpCenter();
            image.set({ left: center.x, top: center.y, originX: 'center', originY: 'center' });
            if (image.width > 600) image.scaleToWidth(600);
            canvas.add(image);
            canvas.setActiveObject(image);
            setMode('select', document.getElementById('mode-select'));
            canvas.requestRenderAll();
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  });
}

function setMode(mode, btnElement) {
  currentMode = mode;
  document.querySelectorAll('.tool-icon').forEach(btn => btn.classList.remove('active'));
  if(btnElement) btnElement.classList.add('active');

  if (mode === 'draw') {
    canvas.isDrawingMode = true; canvas.selection = false; canvas.defaultCursor = 'crosshair';
  } else if (mode === 'erase') {
    canvas.isDrawingMode = false; canvas.selection = false; canvas.defaultCursor = 'crosshair'; 
  } else if (mode === 'select') {
    canvas.isDrawingMode = false; canvas.selection = true; canvas.defaultCursor = 'default';
  } else if (mode === 'pan') {
    canvas.isDrawingMode = false; canvas.selection = false; canvas.defaultCursor = 'grab';
  } else if (mode.startsWith('shape-')) {
    canvas.isDrawingMode = false; canvas.selection = false; canvas.defaultCursor = 'crosshair';
  }
}

// ─── CORE EXPORTS ───
window.openWhiteboard = function(prob) {
  currentActiveProblem = prob;
  document.getElementById('wb-title').textContent = `Whiteboard: ${prob.title}`;
  document.getElementById('wb-modal').classList.add('show');
  
  initCanvas();
  canvas.clear();
  canvas.setViewportTransform([1,0,0,1,0,0]); 
  setMode('draw', document.getElementById('mode-draw'));

  if (prob.whiteboard_data) {
      let data = typeof prob.whiteboard_data === 'string' ? JSON.parse(prob.whiteboard_data) : prob.whiteboard_data;
      canvas.loadFromJSON(data, canvas.renderAll.bind(canvas));
  }
};

document.getElementById('wb-close').addEventListener('click', () => {
  document.getElementById('wb-modal').classList.remove('show');
  currentActiveProblem = null;
});

document.getElementById('wb-clear').addEventListener('click', () => canvas.clear());

document.getElementById('wb-save').addEventListener('click', async () => {
  const btn = document.getElementById('wb-save');
  btn.textContent = "Saving...";
  
  const drawingData = canvas.toJSON();

  try {
    const res = await window.apiPut(currentActiveProblem.id, { 
        ...currentActiveProblem, 
        whiteboard_data: drawingData 
    });
    Object.assign(currentActiveProblem, res.problem);
    window.toast('Drawing Saved!');
    document.getElementById('wb-modal').classList.remove('show');
  } catch (e) {
    window.toast('Failed to save drawing');
  }
  btn.textContent = "Save Drawing";
});