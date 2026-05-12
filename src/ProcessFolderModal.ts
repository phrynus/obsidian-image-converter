// NEW: ProcessFolderModal.ts
import {
    App,
    Modal,
    Notice,
    Setting,
    ButtonComponent,
    ExtraButtonComponent,
    TFile,
    TFolder,
    TextComponent,
    normalizePath
} from "obsidian";
import ImageConverterPlugin from './main';
import { BatchImageProcessor } from './BatchImageProcessor';
import { CanvasData } from './canvas-types';

enum ImageSource {
    DIRECT = "direct",
    LINKED = "linked",
}
export class ProcessFolderModal extends Modal {
    private recursive = false;

    // --- Image Source Enum ---
    private selectedImageSource: ImageSource = ImageSource.DIRECT; // Default to Direct

    // --- Settings UI Elements ---
    imageSourceSetting: Setting | null = null;
    qualitySetting: Setting | null = null;
    convertToSetting: Setting | null = null;
    skipFormatsSetting: Setting | null = null;
    resizeModeSetting: Setting | null = null;
    resizeInputSettings: Setting | null = null;
    enlargeReduceSettings: Setting | null = null;
    skipTargetFormatSetting: Setting | null = null;
    resizeInputsDiv: HTMLDivElement | null = null;
    enlargeReduceDiv: HTMLDivElement | null = null;

    // --- Image Counts ---
    private imageCount = 0;
    private processedCount = 0;
    private skippedCount = 0;
    private imageCountDisplay: HTMLSpanElement;
    private processedCountDisplay: HTMLSpanElement;
    private skippedCountDisplay: HTMLSpanElement;

    // --- Description Updating ---
    private updateImageSourceDescription:
        | ((source: ImageSource | null) => void)
        | null = null;

        constructor(
            app: App,
            private plugin: ImageConverterPlugin,
            private folderPath: string,
            private batchImageProcessor: BatchImageProcessor  // Inject instead of creating new
        ) {
            super(app);
        }



    // Obsidian calls Modal.onOpen as a lifecycle hook and intentionally ignores the returned Promise.
    // We keep this method async to allow await inside, so we disable the no-misused-promises rule here.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.addClass("image-convert-modal"); // Add a class for styling
        await this.createUI(contentEl);

        // Initialize image counts after UI elements are created
        await this.updateImageCountsAndDisplay();
    }

    onClose() {
        // Clear settings UI elements
        this.imageSourceSetting = null;
        this.qualitySetting = null;
        this.convertToSetting = null;
        this.skipFormatsSetting = null;
        this.resizeModeSetting = null;
        this.resizeInputSettings = null;
        this.enlargeReduceSettings = null;
        this.skipTargetFormatSetting = null;
        this.resizeInputsDiv = null;
        this.enlargeReduceDiv = null;
    
        // Clear description updater
        this.updateImageSourceDescription = null;
    
        const { contentEl } = this;
        contentEl.empty();
    }

    // --- UI Creation Methods ---

    private async createUI(contentEl: HTMLElement) {
        this.createHeader(contentEl);
        // --- Warning Message ---
        this.createWarningMessage(contentEl);


        // --- Image Counts ---
        this.createImageCountsDisplay(contentEl);


        // Create settings sections (no longer collapsible)
        const settingsContainer = contentEl.createDiv({
            cls: "settings-container",
        });



        this.createImageSourceSettings(settingsContainer);

        // Format and Quality Container
        const formatQualityContainer = settingsContainer.createDiv({
            cls: "format-quality-container",
        });
        await this.createGeneralSettings(formatQualityContainer);

        // Resize Container
        const resizeContainer = settingsContainer.createDiv({
            cls: "resize-container",
        });
        await this.createResizeSettings(resizeContainer);

        // Skip Container
        const skipContainer = settingsContainer.createDiv({
            cls: "skip-container",
        });
        this.createSkipSettings(skipContainer);

        this.createProcessButton(settingsContainer);

    }

    private createHeader(contentEl: HTMLElement) {
        const folderName = this.folderPath.split("/").pop() || this.folderPath;
        const headerContainer = contentEl.createDiv({ cls: "modal-header" });

        // Main title
        headerContainer.createEl("h2", { text: "转换、压缩和缩放" });

        // Subtitle
        headerContainer.createEl("h6", {
            text: `all images in: /${folderName}`,
            cls: "modal-subtitle", // Add a class for styling
        });
    }

    // --- Warning Message ---
    private createWarningMessage(contentEl: HTMLElement) {
        contentEl.createEl("p", {
            cls: "modal-warning",
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            text: "⚠️ This will modify all images in the selected folder and subfolders (if recursive is enabled). Please ensure you have backups.",
        });
    }

    // --- Image Counts Display ---
    private createImageCountsDisplay(contentEl: HTMLElement) {

        const countsDisplay = contentEl.createDiv({
            cls: "image-counts-display-container",
        });

        // Add Image Source Description here
        const imageSourceDesc = countsDisplay.createDiv({
            cls: "image-source-description",
        });
        imageSourceDesc.id = "image-source-description"; // Set ID for aria-describedby

        // Function to update the description text
        const updateDescription = (source: ImageSource | null) => {
            let descText = "未选择。"; // Default text
            if (source === ImageSource.DIRECT) {
                descText =
                    "正在处理文件夹中的直接图片。";
            } else if (source === ImageSource.LINKED) {
                descText =
                    "正在处理笔记或 Canvas 文件中链接的图片。";
            }
            imageSourceDesc.setText(descText);
        };

        // Update description when the selected image source changes
        this.updateImageSourceDescription = updateDescription;

        // Set initial description
        updateDescription(this.selectedImageSource);
        // Image Counts
        countsDisplay.createEl("span", { text: "共找到图片：" });
        this.imageCountDisplay = countsDisplay.createEl("span", {
            text: this.imageCount.toString(),
        });

        countsDisplay.createEl("br");

        countsDisplay.createEl("span", { text: "将跳过：" });
        this.skippedCountDisplay = countsDisplay.createEl("span", {
            text: this.skippedCount.toString(),
        });

        countsDisplay.createEl("br");

        countsDisplay.createEl("span", { text: "待处理：" });
        this.processedCountDisplay = countsDisplay.createEl("span", {
            text: this.processedCount.toString(),
        });


    }

    // --- Image Source Settings with Radio Buttons ---
    private createImageSourceSettings(contentEl: HTMLElement) {
        contentEl.createEl("h4", { text: "图片来源" }); // Heading for Image Source

        // --- Recursive Setting ---
        new Setting(contentEl)
            .setName("递归")
            .setDesc("同时处理所有子文件夹中的图片")
            .addToggle((toggle) =>
                toggle.setValue(this.recursive).onChange(async (value) => {
                    this.recursive = value;
                    await this.updateImageCountsAndDisplay();
                })
            );

        const imageSourceSettingContainer = contentEl.createDiv();
        imageSourceSettingContainer.addClass("image-source-setting-container");

        // Store button references for updating later
        const buttonRefs: Record<ImageSource, ExtraButtonComponent | null> = {
            [ImageSource.DIRECT]: null,
            [ImageSource.LINKED]: null,
        };

        // Function to update the icons of the radio buttons
        const updateIcons = () => {
            Object.entries(buttonRefs).forEach(([source, button]) => {
                if (!button) return;
                button.setIcon(
                    this.selectedImageSource === (source as ImageSource)
                        ? "lucide-check-circle"
                        : "lucide-circle"
                );
            });
        };

        // --- Create Radio Buttons ---
        new Setting(imageSourceSettingContainer)
            .setName("直接图片")
            .setDesc("文件夹中的直接图片")
            .addExtraButton((button) => {
                buttonRefs[ImageSource.DIRECT] = button;
                button
                    .setIcon(
                        this.selectedImageSource === ImageSource.DIRECT
                            ? "lucide-check-circle"
                            : "lucide-circle"
                    )
                    .setTooltip(
                        this.selectedImageSource === ImageSource.DIRECT
                            ? "Selected"
                            : "Select"
                    )
                    .onClick(async () => {
                        this.selectedImageSource = ImageSource.DIRECT;
                        if (this.updateImageSourceDescription) {
                            this.updateImageSourceDescription(
                                this.selectedImageSource
                            );
                        }
                        await this.updateImageCountsAndDisplay();
                        updateIcons();
                    });
            });

        new Setting(imageSourceSettingContainer)
            .setName("链接的图片")
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .setDesc("笔记或 Canvas 中链接的图片")
            .addExtraButton((button) => {
                buttonRefs[ImageSource.LINKED] = button;
                button
                    .setIcon(
                        this.selectedImageSource === ImageSource.LINKED
                            ? "lucide-check-circle"
                            : "lucide-circle"
                    )
                    .setTooltip(
                        this.selectedImageSource === ImageSource.LINKED
                            ? "Selected"
                            : "Select"
                    )
                    .onClick(async () => {
                        this.selectedImageSource = ImageSource.LINKED;
                        if (this.updateImageSourceDescription) {
                            this.updateImageSourceDescription(
                                this.selectedImageSource
                            );
                        }
                        await this.updateImageCountsAndDisplay();
                        updateIcons();
                    });
            });

        // Add the radio button container to contentEl
        contentEl.appendChild(imageSourceSettingContainer);

        // Set initial description and update icons
        if (this.updateImageSourceDescription) {
            this.updateImageSourceDescription(this.selectedImageSource);
        }
        updateIcons();
    }

    // --- General Settings ---
    private async createGeneralSettings(contentEl: HTMLElement) {
        contentEl.createEl("h4", { text: "常规" }); // Heading for General Settings

        // --- Convert To Setting ---
        this.convertToSetting = new Setting(contentEl)
            .setName("转换为 ⓘ")
            .setDesc(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "Choose output format. '保持原格式' applies compression/resizing to current format."
            )
            .setTooltip(
                "保持原格式：保留当前格式，同时应用压缩/缩放"
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("disabled", "Same as original")
                    .addOptions({
                        webp: "WebP",
                        jpg: "JPG",
                        png: "PNG",
                    })
                    .setValue(this.plugin.settings.ProcessCurrentNoteconvertTo)
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessCurrentNoteconvertTo = value;
                        await this.plugin.saveSettings();
                        await this.updateImageCountsAndDisplay();
                    });
            });

        // --- Quality Setting ---
        this.qualitySetting = new Setting(contentEl)
            .setName("质量 ⓘ")
            .setDesc("压缩级别 (0-100)")
            .setTooltip(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "100: No compression (original quality)\n75: Recommended (good balance)\n0-50: High compression (lower quality)"
            )
            .addText((text) => {
                text
                    .setPlaceholder("输入质量 (0-100)")
                    .setValue(
                        (
                            this.plugin.settings.ProcessCurrentNotequality * 100
                        ).toString()
                    )
                    .onChange(async (value) => {
                        const quality = parseInt(value, 10);
                        if (
                            !isNaN(quality) &&
                            quality >= 0 &&
                            quality <= 100
                        ) {
                            this.plugin.settings.ProcessCurrentNotequality =
                                quality / 100;
                            await this.plugin.saveSettings();
                            await this.updateImageCountsAndDisplay();
                        } else {
                            // Optionally show an error message to the user
                            // using a Notice or by adding an error class to the input
                        }
                    });
            });
    }

    private createSkipSettings(contentEl: HTMLElement): void {
        contentEl.createEl("h4", { text: "跳过" }); // Heading for Resize Settings

        // --- Skip Formats Setting ---
        this.skipFormatsSetting = new Setting(contentEl)
            .setName("跳过格式 ⓘ")
            .setDesc(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "Comma-separated list (no dots or spaces, e.g., png,gif)."
            )
            .setTooltip(
                "要跳过的文件格式，逗号分隔列表（例如：tif,tiff,heic）。留空则处理所有格式。"
            )
            .addText((text) => {
                text
                    // eslint-disable-next-line obsidianmd/ui/sentence-case
                    .setPlaceholder("png,gif")
                    .setValue(
                        this.plugin.settings.ProcessCurrentNoteSkipFormats
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessCurrentNoteSkipFormats =
                            value;
                        await this.plugin.saveSettings();
                        await this.updateImageCountsAndDisplay();
                    });
            });

        // --- Skip Target Format Setting ---
        this.skipTargetFormatSetting = new Setting(contentEl)
            .setName("跳过目标格式图片 ⓘ")
            .setDesc(
                "如果图片已是目标格式，则跳过压缩/缩放。"
            )
            .setTooltip(
                "如果图片已是目标格式，可跳过其压缩、转换和缩放。其他格式的图片仍会被处理。"
            )
            .addToggle((toggle) => {
                toggle
                    .setValue(
                        this.plugin.settings.ProcessCurrentNoteskipImagesInTargetFormat
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessCurrentNoteskipImagesInTargetFormat =
                            value;
                        await this.plugin.saveSettings();
                        await this.updateImageCountsAndDisplay(); // Update counts on change
                    });
            });
    }

    // --- Resize Settings ---
    private async createResizeSettings(contentEl: HTMLElement) {
        contentEl.createEl("h4", { text: "缩放" }); // Heading for Resize Settings

        // --- Resize Mode Setting ---
        this.resizeModeSetting = new Setting(contentEl)
            .setName("缩放模式 ⓘ")
            .setDesc(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "选择图片的缩放方式。注意：结果不可逆"
            )
            .setTooltip(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "Fit: Maintains aspect ratio within dimensions\nFill: Exactly matches dimensions\nLongest Edge: Limits the longest side\nShortest Edge: Limits the shortest side\nWidth/Height: Constrains single dimension"
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        None: "无",
                        Fit: "适应（在尺寸范围内保持宽高比）",
                        Fill: "填充（精确匹配尺寸）",
                        LongestEdge: "最长边",
                        ShortestEdge: "最短边",
                        Width: "宽度",
                        Height: "高度",
                    })
                    .setValue(
                        this.plugin.settings
                            .ProcessCurrentNoteResizeModalresizeMode
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessCurrentNoteResizeModalresizeMode =
                            value;
                        await this.plugin.saveSettings();
                        this.updateResizeInputVisibility(value);
                        await this.updateImageCountsAndDisplay();
                    });
            });

        // --- Enlarge/Reduce Setting ---
        this.createEnlargeReduceInputs(contentEl);

        // --- Resize Inputs (Conditional) ---
        this.resizeInputsDiv = contentEl.createDiv({ cls: "resize-inputs" });
        this.updateResizeInputVisibility(
            this.plugin.settings.ProcessCurrentNoteResizeModalresizeMode
        );
    }

    private createEnlargeReduceInputs(contentEl: HTMLElement) {
        this.enlargeReduceDiv = contentEl.createDiv({
            cls: "enlarge-reduce-settings",
        });
        this.createEnlargeReduceSettings();
    }

    private createProcessButton(contentEl: HTMLElement) {
        const buttonContainer = contentEl.createDiv({ cls: "button-container" });
        new ButtonComponent(buttonContainer)
            .setButtonText("处理")
            .setCta()
            .onClick(async () => { // Use async here
                this.close();
                // Respect the selected image source when processing
                if (this.selectedImageSource === ImageSource.DIRECT) {
                    await this.batchImageProcessor.processImagesInFolder(this.folderPath, this.recursive);
                } else if (this.selectedImageSource === ImageSource.LINKED) {
                    await this.batchImageProcessor.processLinkedImagesInFolder(this.folderPath, this.recursive);
                }
            });
    }

    // --- Helper Methods for Settings ---

    private updateResizeInputVisibility(resizeMode: string): void {
        if (resizeMode === "无") {
            this.resizeInputsDiv?.empty();
            this.enlargeReduceDiv?.hide(); // Explicitly hide it
            this.resizeInputSettings = null;
            this.enlargeReduceSettings = null;
        } else {
            if (!this.resizeInputSettings) {
                this.createResizeInputSettings(resizeMode);
            } else {
                this.updateResizeInputSettings(resizeMode);
            }

            if (!this.enlargeReduceSettings) {
                this.createEnlargeReduceSettings();
            }
            this.enlargeReduceDiv?.show(); // Show only when not None
        }
    }

    private createEnlargeReduceSettings(): void {
        if (!this.enlargeReduceDiv) return;

        this.enlargeReduceDiv.empty();

        this.enlargeReduceSettings = new Setting(this.enlargeReduceDiv)
            .setClass("enlarge-reduce-setting")
            .setName("放大或缩小 ⓘ")
            .setDesc(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "缩小并放大：调整所有图片。仅缩小：只缩小较大图片。仅放大：只放大较小图片。"
            )
            .setTooltip(
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                "• Reduce and enlarge: Adjusts all images to fit specified dimensions\n• Reduce only: Only shrinks images larger than target\n• Enlarge only: Only enlarges images smaller than target"
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        Always: "缩小并放大",
                        Reduce: "仅缩小",
                        Enlarge: "仅放大",
                    })
                    .setValue(
                        this.plugin.settings.ProcessCurrentNoteEnlargeOrReduce
                    )
                    .onChange(
                        async (value: "Always" | "Reduce" | "Enlarge") => {
                            this.plugin.settings.ProcessCurrentNoteEnlargeOrReduce =
                                value;
                            await this.plugin.saveSettings();
                        }
                    );
            });
    }

    private createResizeInputSettings(resizeMode: string): void {
        if (!this.resizeInputsDiv) return;

        this.resizeInputsDiv.empty();

        this.resizeInputSettings = new Setting(this.resizeInputsDiv).setClass(
            "resize-input-setting"
        );

        this.updateResizeInputSettings(resizeMode);
    }

    private updateResizeInputSettings(resizeMode: string): void {
        if (!this.resizeInputSettings) return;

        this.resizeInputSettings.clear();

        let name = "";
        let desc = "";

        if (["Fit", "Fill"].includes(resizeMode)) {
            name = "缩放尺寸";
            desc = "输入期望的宽度和高度（像素）";
            this.resizeInputSettings
                .setName(name)
                .setDesc(desc)
                .addText((text: TextComponent) =>
                    text
                        .setPlaceholder("宽度")
                        .setValue(
                            this.plugin.settings
                                .ProcessCurrentNoteresizeModaldesiredWidth
                                .toString()
                        )
                        .onChange(async (value: string) => {
                            const width = parseInt(value);
                            if (/^\d+$/.test(value) && width > 0) {
                                this.plugin.settings.ProcessCurrentNoteresizeModaldesiredWidth =
                                    width;
                                await this.plugin.saveSettings();
                            }
                        })
                )
                .addText((text: TextComponent) =>
                    text
                        .setPlaceholder("高度")
                        .setValue(
                            this.plugin.settings
                                .ProcessCurrentNoteresizeModaldesiredHeight
                                .toString()
                        )
                        .onChange(async (value: string) => {
                            const height = parseInt(value);
                            if (/^\d+$/.test(value) && height > 0) {
                                this.plugin.settings.ProcessCurrentNoteresizeModaldesiredHeight =
                                    height;
                                await this.plugin.saveSettings();
                            }
                        })
                );
        } else {
            switch (resizeMode) {
                case "最长边":
                case "最短边":
                    name = `${resizeMode}`;
                    desc = "输入期望的长度（像素）";
                    break;
                case "宽度":
                    name = "宽度";
                    desc = "输入期望的宽度（像素）";
                    break;
                case "高度":
                    name = "高度";
                    desc = "输入期望的高度（像素）";
                    break;
            }

            this.resizeInputSettings
                .setName(name)
                .setDesc(desc)
                .addText((text: TextComponent) =>
                    text
                        .setPlaceholder("")
                        .setValue(this.getInitialValue(resizeMode).toString())
                        .onChange(async (value: string) => {
                            const length = parseInt(value);
                            if (/^\d+$/.test(value) && length > 0) {
                                await this.updateSettingValue(
                                    resizeMode,
                                    length
                                );
                            }
                        })
                );
        }
    }

    private getInitialValue(resizeMode: string): number {
        switch (resizeMode) {
            case "最长边":
            case "最短边":
                return this.plugin.settings
                    .ProcessCurrentNoteresizeModaldesiredLength;
            case "宽度":
                return this.plugin.settings
                    .ProcessCurrentNoteresizeModaldesiredWidth;
            case "高度":
                return this.plugin.settings
                    .ProcessCurrentNoteresizeModaldesiredHeight;
            default:
                return 0;
        }
    }

    private async updateSettingValue(
        resizeMode: string,
        value: number
    ): Promise<void> {
        switch (resizeMode) {
            case "最长边":
            case "最短边":
                this.plugin.settings.ProcessCurrentNoteresizeModaldesiredLength =
                    value;
                break;
            case "宽度":
                this.plugin.settings.ProcessCurrentNoteresizeModaldesiredWidth =
                    value;
                break;
            case "高度":
                this.plugin.settings.ProcessCurrentNoteresizeModaldesiredHeight =
                    value;
                break;
        }
        await this.plugin.saveSettings();
    }

    // --- Image Counting and Updating ---

    private async updateImageCountsAndDisplay() {
        const counts = await this.updateImageCounts();
        this.updateCountDisplays(counts);
    }

    private async updateImageCounts(): Promise<{
        total: number;
        processed: number;
        skipped: number;
    }> {
        const folder = this.app.vault.getAbstractFileByPath(this.folderPath);
        if (!(folder instanceof TFolder)) {
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            new Notice("错误：无效的文件夹路径。");
            return { total: 0, processed: 0, skipped: 0 };
        }

        const skipFormats = this.plugin.settings.ProcessCurrentNoteSkipFormats
            .toLowerCase()
            .split(",")
            .map((format) => format.trim())
            .filter((format) => format.length > 0);

        const targetFormat = this.plugin.settings.ProcessCurrentNoteconvertTo;
        const skipTargetFormat = this.plugin.settings.ProcessCurrentNoteskipImagesInTargetFormat;

        // Use the selectedImageSource to filter images
        const { directImages, linkedImages } = await this.getImageFiles(
            folder,
            this.recursive,
            this.selectedImageSource
        );

        let total = 0;
        let processed = 0;
        let skipped = 0;

        for (const image of directImages) {
            total++;
            if (skipFormats.includes(image.extension.toLowerCase())) {
                skipped++;
            } else if (skipTargetFormat && image.extension.toLowerCase() === targetFormat) {
                skipped++;
            } else {
                processed++;
            }
        }

        for (const image of linkedImages) {
            total++;
            if (skipFormats.includes(image.extension.toLowerCase())) {
                skipped++;
            } else if (skipTargetFormat && image.extension.toLowerCase() === targetFormat) {
                skipped++;
            } else {
                processed++;
            }
        }

        console.debug("updateImageCounts:", {
            total,
            processed,
            skipped,
            directImages,
            linkedImages,
        });
        return { total, processed, skipped };
    }

    async getImageFiles(
        folder: TFolder,
        recursive: boolean,
        selectedImageSource: ImageSource
    ): Promise<{
        directImages: TFile[];
        linkedImages: TFile[];
    }> {
        const directImages: TFile[] = [];
        const linkedImages: TFile[] = [];

        for (const file of folder.children) {
            if (file instanceof TFolder) {
                if (recursive) {
                    // Recursive case: process subfolders
                    const {
                        directImages: subfolderDirectImages,
                        linkedImages: subfolderLinkedImages,
                    } = await this.getImageFiles(
                        file,
                        recursive,
                        selectedImageSource
                    );
                    directImages.push(...subfolderDirectImages);
                    linkedImages.push(...subfolderLinkedImages);
                }
            } else if (file instanceof TFile) {
                if (
                    selectedImageSource === ImageSource.DIRECT &&
                    this.plugin.supportedImageFormats.isSupported(undefined, file.name)
                ) {
                    // Direct image and direct source is selected
                    directImages.push(file);
                } else if (
                    selectedImageSource === ImageSource.LINKED &&
                    file.extension === "md"
                ) {
                    // Linked image in Markdown and linked source is selected
                    const linkedImagesInMarkdown =
                        await this.getImagesFromMarkdownFile(file);
                    linkedImages.push(...linkedImagesInMarkdown);
                } else if (
                    selectedImageSource === ImageSource.LINKED &&
                    file.extension === "canvas"
                ) {
                    // Linked image in Canvas and linked source is selected
                    const linkedImagesInCanvas =
                        await this.getImagesFromCanvasFile(file);
                    linkedImages.push(...linkedImagesInCanvas);
                }
            }
        }

        console.debug(
            "Images found in folder",
            folder.path,
            ":",
            { directImages, linkedImages },
            "recursive:",
            recursive,
            "selectedImageSource:",
            selectedImageSource
        );
        return { directImages, linkedImages };
    }

    async getImagesFromMarkdownFile(markdownFile: TFile): Promise<TFile[]> {
        console.debug("Getting images from Markdown file:", markdownFile.path);
        const images: TFile[] = [];
        const content = await this.app.vault.read(markdownFile);
        const { vault } = this.app;

        // 1. Handle WikiLinks
        const wikiRegex = /!\[\[([^\]]+?)(?:\|[^\]]+?)?\]\]/g; // Matches ![[image.png]] and ![[image.png|141]]
        let match;
        while ((match = wikiRegex.exec(content)) !== null) {
            const [, linkedFileName] = match;
            const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
                linkedFileName,
                markdownFile.path
            );
            if (linkedFile instanceof TFile && this.plugin.supportedImageFormats.isSupported(undefined, linkedFile.name)) {
                images.push(linkedFile);
            }
        }

        // 2. Handle Markdown Links
        const markdownImageRegex = /!\[.*?\]\(([^)]+?)\)/g; // Matches ![alt text](image.png)
        while ((match = markdownImageRegex.exec(content)) !== null) {
            const [, imagePath] = match;
            if (!imagePath.startsWith("http")) {
                // Skip external URLs
                // Resolve the relative path of the image from the root of the vault
                const absoluteImagePath = normalizePath(
                    `${vault.getRoot().path}/${imagePath}`
                );

                const linkedImageFile =
                    vault.getAbstractFileByPath(absoluteImagePath);

                if (
                    linkedImageFile instanceof TFile &&
                    this.plugin.supportedImageFormats.isSupported(undefined, linkedImageFile.name)
                ) {
                    console.debug(
                        "Found relative linked image:",
                        linkedImageFile.path
                    );
                    images.push(linkedImageFile);
                }
            }
        }

        console.debug(
            "Images found in Markdown file:",
            images.map((file) => file.path)
        );
        return images;
    }

    // Helper function to extract image names from Markdown content (both Wiki and Markdown links)
    extractLinkedImageNames(content: string): string[] {
        const wikiRegex = /!\[\[([^\]]+?)(?:\|[^\]]+?)?\]\]/g; // Matches ![[image.png]] and ![[image.png|141]]
        const markdownRegex = /!\[.*?\]\(([^)]+?)\)/g; // Matches ![alt text](image.png) and ![alt text](image.png "Title")
        const imageNames: string[] = [];
        let match;

        // Find Wiki-style links
        while ((match = wikiRegex.exec(content)) !== null) {
            imageNames.push(match[1]);
        }

        // Find Markdown-style links
        while ((match = markdownRegex.exec(content)) !== null) {
            imageNames.push(match[1]);
        }

        console.debug("Image names extracted from Markdown:", imageNames);
        return imageNames;
    }

    // Helper function to get the full path relative to a folder
    getFullPath(parentFolder: TFolder | null, relativePath: string): string {
        if (parentFolder) {
            return normalizePath(`${parentFolder.path}/${relativePath}`);
        }
        // If parentFolder is null, the file is in the root of the vault
        return normalizePath(relativePath);
    }

    async getImagesFromCanvasFile(file: TFile): Promise<TFile[]> {
        const images: TFile[] = [];
        const content = await this.app.vault.read(file);
        
        let canvasData: CanvasData;
        try {
            canvasData = JSON.parse(content) as CanvasData;
        } catch (error) {
            console.warn(`Failed to parse canvas file: ${file.path}`, error);
            return images;
        }

        if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
            for (const node of canvasData.nodes) {
                if (node.type === "file" && node.file) {
                    const linkedFile =
                        this.app.vault.getAbstractFileByPath(node.file);
                    if (!linkedFile) {
                        console.warn("Could not find file:", node.file);
                        continue;
                    }
                    if (linkedFile instanceof TFile && this.plugin.supportedImageFormats.isSupported(undefined, linkedFile.name)) {
                        images.push(linkedFile);
                    }
                }
            }
        }

        return images;
    }

    private updateCountDisplays(counts: {
        total: number;
        processed: number;
        skipped: number;
    }) {
        this.imageCount = counts.total;
        this.processedCount = counts.processed;
        this.skippedCount = counts.skipped;

        this.imageCountDisplay.setText(counts.total.toString());
        this.processedCountDisplay.setText(counts.processed.toString());
        this.skippedCountDisplay.setText(counts.skipped.toString());
    }
}