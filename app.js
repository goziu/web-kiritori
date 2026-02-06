/**
 * 切り取りくん - 画像トリミングアプリケーション
 * ブラウザ上で動作する画像トリミングツール
 */

class ImageCropper {
    constructor() {
        // DOM要素の取得
        this.uploadZone = document.getElementById('upload-zone');
        this.editorZone = document.getElementById('editor-zone');
        this.fileInput = document.getElementById('file-input');
        this.canvas = document.getElementById('image-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.cropBox = document.getElementById('crop-box');
        this.imageScaleSlider = document.getElementById('image-scale');
        this.scaleValue = document.getElementById('scale-value');
        this.cropWidthInput = document.getElementById('crop-width');
        this.cropHeightInput = document.getElementById('crop-height');
        
        // ボタン
        this.clearBtn = document.getElementById('clear-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.cropBtn = document.getElementById('crop-btn');
        this.downloadBtn = document.getElementById('download-btn');
        
        // 状態管理
        this.originalImage = null;
        this.croppedImage = null;
        this.imageScale = 1;
        this.imagePosition = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.currentAspectRatio = 'free';
        this.cropSize = { width: 300, height: 300 };
        
        // リサイズ状態管理
        this.isResizing = false;
        this.resizeDirection = null;
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        
        this.init();
    }
    
    /**
     * 初期化
     */
    init() {
        this.setupEventListeners();
        this.updateCropBox();
    }
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // ファイル選択
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // ドラッグ&ドロップ
        this.uploadZone.addEventListener('click', () => this.fileInput.click());
        this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadZone.addEventListener('drop', (e) => this.handleDrop(e));
        
        // 画像のドラッグ移動
        this.canvas.addEventListener('mousedown', (e) => this.startDrag(e));
        this.canvas.addEventListener('mousemove', (e) => this.drag(e));
        this.canvas.addEventListener('mouseup', () => this.endDrag());
        this.canvas.addEventListener('mouseleave', () => this.endDrag());
        
        // タッチイベント
        this.canvas.addEventListener('touchstart', (e) => this.startDrag(e));
        this.canvas.addEventListener('touchmove', (e) => this.drag(e));
        this.canvas.addEventListener('touchend', () => this.endDrag());
        
        // スライダー
        this.imageScaleSlider.addEventListener('input', (e) => this.handleScaleChange(e));
        
        // 縦横比変更
        document.querySelectorAll('input[name="aspect-ratio"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleAspectRatioChange(e));
        });
        
        // サイズ入力
        this.cropWidthInput.addEventListener('input', () => this.handleSizeInput());
        this.cropHeightInput.addEventListener('input', () => this.handleSizeInput());
        
        // ボタン
        this.clearBtn.addEventListener('click', () => this.clearImage());
        this.resetBtn.addEventListener('click', () => this.resetImage());
        this.cropBtn.addEventListener('click', () => this.cropImage());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        
        // リサイズハンドル
        this.setupResizeHandles();
    }
    
    /**
     * リサイズハンドルのイベントリスナー設定
     */
    setupResizeHandles() {
        const handles = this.cropBox.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.startResize(e));
            handle.addEventListener('touchstart', (e) => this.startResize(e));
        });
        
        // グローバルイベント
        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', () => this.endResize());
        document.addEventListener('touchmove', (e) => this.resize(e));
        document.addEventListener('touchend', () => this.endResize());
    }
    
    /**
     * ファイル選択処理
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
    }
    
    /**
     * ドラッグオーバー処理
     */
    handleDragOver(e) {
        e.preventDefault();
        this.uploadZone.classList.add('dragover');
    }
    
    /**
     * ドラッグリーブ処理
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('dragover');
    }
    
    /**
     * ドロップ処理
     */
    handleDrop(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
    }
    
    /**
     * 画像読み込み
     */
    loadImage(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.croppedImage = null;
                this.imageScale = 1;
                this.imagePosition = { x: 0, y: 0 };
                
                // キャンバスサイズを設定
                this.setupCanvas();
                
                // UIを更新
                this.uploadZone.style.display = 'none';
                this.editorZone.style.display = 'flex';
                this.enableControls();
                
                // スライダーをリセット
                this.imageScaleSlider.value = 100;
                this.scaleValue.textContent = '100%';
                
                // 画像を描画
                this.drawImage();
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }
    
    /**
     * キャンバスのセットアップ
     */
    setupCanvas() {
        const maxWidth = 800;
        const maxHeight = 600;
        
        let width = this.originalImage.width;
        let height = this.originalImage.height;
        
        // 最大サイズに収まるように調整
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // 画像の初期位置を中央に
        this.imagePosition = {
            x: width / 2,
            y: height / 2
        };
    }
    
    /**
     * 画像を描画
     */
    drawImage() {
        if (!this.originalImage) return;
        
        const img = this.croppedImage || this.originalImage;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const scaledWidth = img.width * this.imageScale;
        const scaledHeight = img.height * this.imageScale;
        
        this.ctx.drawImage(
            img,
            this.imagePosition.x - scaledWidth / 2,
            this.imagePosition.y - scaledHeight / 2,
            scaledWidth,
            scaledHeight
        );
    }
    
    /**
     * リサイズ開始
     */
    startResize(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.isResizing = true;
        this.resizeDirection = e.target.dataset.direction;
        
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        
        this.resizeStart = {
            x: clientX,
            y: clientY,
            width: this.cropSize.width,
            height: this.cropSize.height
        };
    }
    
    /**
     * リサイズ中
     */
    resize(e) {
        if (!this.isResizing) return;
        
        e.preventDefault();
        
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - this.resizeStart.x;
        const deltaY = clientY - this.resizeStart.y;
        
        let newWidth = this.resizeStart.width;
        let newHeight = this.resizeStart.height;
        
        const direction = this.resizeDirection;
        const ratio = this.getAspectRatioValue();
        const isAspectLocked = this.currentAspectRatio !== 'free';
        
        // 方向に応じてサイズを計算
        if (direction.includes('e')) {
            newWidth = Math.max(50, this.resizeStart.width + deltaX);
        }
        if (direction.includes('w')) {
            newWidth = Math.max(50, this.resizeStart.width - deltaX);
        }
        if (direction.includes('s')) {
            newHeight = Math.max(50, this.resizeStart.height + deltaY);
        }
        if (direction.includes('n')) {
            newHeight = Math.max(50, this.resizeStart.height - deltaY);
        }
        
        // 縦横比が固定されている場合
        if (isAspectLocked) {
            if (direction.includes('e') || direction.includes('w')) {
                // 横方向の変更時は高さを調整
                newHeight = newWidth / ratio;
            } else if (direction.includes('n') || direction.includes('s')) {
                // 縦方向の変更時は幅を調整
                newWidth = newHeight * ratio;
            }
        }
        
        // 最小サイズ制限
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);
        
        // キャンバスサイズを超えないように制限
        if (this.canvas) {
            newWidth = Math.min(newWidth, this.canvas.width - 20);
            newHeight = Math.min(newHeight, this.canvas.height - 20);
            
            // 縦横比維持の場合は再計算
            if (isAspectLocked) {
                if (newWidth / ratio > newHeight) {
                    newWidth = newHeight * ratio;
                } else {
                    newHeight = newWidth / ratio;
                }
            }
        }
        
        this.cropSize = { 
            width: Math.round(newWidth), 
            height: Math.round(newHeight) 
        };
        
        // UIを更新
        this.updateCropBoxSize();
        
        // 入力フォームも更新
        this.cropWidthInput.value = Math.round(newWidth);
        this.cropHeightInput.value = Math.round(newHeight);
    }
    
    /**
     * リサイズ終了
     */
    endResize() {
        this.isResizing = false;
        this.resizeDirection = null;
    }
    
    /**
     * ドラッグ開始
     */
    startDrag(e) {
        // リサイズ中は画像ドラッグを無効化
        if (this.isResizing) return;
        
        e.preventDefault();
        this.isDragging = true;
        
        const pos = this.getEventPosition(e);
        this.dragStart = {
            x: pos.x - this.imagePosition.x,
            y: pos.y - this.imagePosition.y
        };
        
        this.canvas.style.cursor = 'grabbing';
    }
    
    /**
     * ドラッグ中
     */
    drag(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        const pos = this.getEventPosition(e);
        
        this.imagePosition = {
            x: pos.x - this.dragStart.x,
            y: pos.y - this.dragStart.y
        };
        
        this.drawImage();
    }
    
    /**
     * ドラッグ終了
     */
    endDrag() {
        this.isDragging = false;
        this.canvas.style.cursor = 'move';
    }
    
    /**
     * イベント位置を取得
     */
    getEventPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        
        return {
            x: (clientX - rect.left) * (this.canvas.width / rect.width),
            y: (clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }
    
    /**
     * スケール変更
     */
    handleScaleChange(e) {
        const value = parseInt(e.target.value);
        this.imageScale = value / 100;
        this.scaleValue.textContent = `${value}%`;
        this.drawImage();
    }
    
    /**
     * 縦横比変更
     */
    handleAspectRatioChange(e) {
        this.currentAspectRatio = e.target.value;
        this.updateCropBox();
    }
    
    /**
     * サイズ入力処理
     */
    handleSizeInput() {
        if (this.currentAspectRatio !== 'free') {
            // 縦横比が固定されている場合は連動させる
            const ratio = this.getAspectRatioValue();
            if (this.cropWidthInput.value) {
                const width = parseInt(this.cropWidthInput.value);
                this.cropHeightInput.value = Math.round(width / ratio);
            }
        }
        this.updateCropBox();
    }
    
    /**
     * 縦横比の値を取得
     */
    getAspectRatioValue() {
        const ratios = {
            'free': 1,
            '1:1': 1,
            '4:3': 4/3,
            '16:9': 16/9,
            '3:4': 3/4,
            '9:16': 9/16
        };
        return ratios[this.currentAspectRatio] || 1;
    }
    
    /**
     * クロップボックスを更新
     */
    updateCropBox() {
        const ratio = this.getAspectRatioValue();
        let width = 300;
        let height = 300;
        
        if (this.currentAspectRatio !== 'free') {
            height = width / ratio;
        }
        
        // ユーザー入力がある場合は優先
        if (this.cropWidthInput.value) {
            width = parseInt(this.cropWidthInput.value);
        }
        if (this.cropHeightInput.value) {
            height = parseInt(this.cropHeightInput.value);
        }
        
        this.cropSize = { width, height };
        this.updateCropBoxSize();
    }
    
    /**
     * クロップボックスのサイズのみ更新
     */
    updateCropBoxSize() {
        this.cropBox.style.width = `${this.cropSize.width}px`;
        this.cropBox.style.height = `${this.cropSize.height}px`;
        
        const overlay = this.cropBox.querySelector('.crop-overlay');
        overlay.style.width = `${this.cropSize.width}px`;
        overlay.style.height = `${this.cropSize.height}px`;
    }
    
    /**
     * 画像をトリミング
     */
    cropImage() {
        if (!this.originalImage) return;
        
        // クロップボックスの中心座標
        const cropCenterX = this.canvas.width / 2;
        const cropCenterY = this.canvas.height / 2;
        
        // 画像の実際の座標
        const img = this.croppedImage || this.originalImage;
        const scaledWidth = img.width * this.imageScale;
        const scaledHeight = img.height * this.imageScale;
        const imgLeft = this.imagePosition.x - scaledWidth / 2;
        const imgTop = this.imagePosition.y - scaledHeight / 2;
        
        // クロップ領域の相対座標
        const cropLeft = cropCenterX - this.cropSize.width / 2;
        const cropTop = cropCenterY - this.cropSize.height / 2;
        
        // 元画像上での座標に変換
        const srcX = (cropLeft - imgLeft) / this.imageScale;
        const srcY = (cropTop - imgTop) / this.imageScale;
        const srcWidth = this.cropSize.width / this.imageScale;
        const srcHeight = this.cropSize.height / this.imageScale;
        
        // 新しいキャンバスを作成してトリミング
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.cropSize.width;
        tempCanvas.height = this.cropSize.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(
            img,
            srcX, srcY, srcWidth, srcHeight,
            0, 0, this.cropSize.width, this.cropSize.height
        );
        
        // トリミング結果を画像として保存
        const croppedImg = new Image();
        croppedImg.onload = () => {
            this.croppedImage = croppedImg;
            this.imageScale = 1;
            this.imagePosition = {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2
            };
            this.imageScaleSlider.value = 100;
            this.scaleValue.textContent = '100%';
            this.drawImage();
            this.downloadBtn.disabled = false;
        };
        croppedImg.src = tempCanvas.toDataURL();
    }
    
    /**
     * 画像をリセット
     */
    resetImage() {
        if (!this.originalImage) return;
        
        this.croppedImage = null;
        this.imageScale = 1;
        this.imagePosition = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2
        };
        this.imageScaleSlider.value = 100;
        this.scaleValue.textContent = '100%';
        this.downloadBtn.disabled = true;
        this.drawImage();
    }
    
    /**
     * 画像をクリア
     */
    clearImage() {
        this.originalImage = null;
        this.croppedImage = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.uploadZone.style.display = 'block';
        this.editorZone.style.display = 'none';
        this.fileInput.value = '';
        
        this.disableControls();
    }
    
    /**
     * 画像をダウンロード
     */
    downloadImage() {
        if (!this.croppedImage) return;
        
        // 出力サイズの決定
        let outputWidth = this.cropSize.width;
        let outputHeight = this.cropSize.height;
        
        if (this.cropWidthInput.value && this.cropHeightInput.value) {
            outputWidth = parseInt(this.cropWidthInput.value);
            outputHeight = parseInt(this.cropHeightInput.value);
        }
        
        // リサイズが必要な場合
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputWidth;
        tempCanvas.height = outputHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(this.croppedImage, 0, 0, outputWidth, outputHeight);
        
        // ダウンロード
        const link = document.createElement('a');
        const timestamp = new Date().getTime();
        link.download = `kiritori-${timestamp}.png`;
        link.href = tempCanvas.toDataURL();
        link.click();
    }
    
    /**
     * コントロールを有効化
     */
    enableControls() {
        this.imageScaleSlider.disabled = false;
        this.clearBtn.disabled = false;
        this.resetBtn.disabled = false;
        this.cropBtn.disabled = false;
    }
    
    /**
     * コントロールを無効化
     */
    disableControls() {
        this.imageScaleSlider.disabled = true;
        this.clearBtn.disabled = true;
        this.resetBtn.disabled = true;
        this.cropBtn.disabled = true;
        this.downloadBtn.disabled = true;
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    new ImageCropper();
});
