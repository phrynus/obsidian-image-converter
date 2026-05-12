// ProcessAllVaultModal.ts
import {
    App,
    Modal,
    Setting,
    ButtonComponent,
} from "obsidian";
import ImageConverterPlugin from "./main";
import { BatchImageProcessor } from "./BatchImageProcessor";

export class ProcessAllVaultModal extends Modal {
    private enlargeReduceSettings: Setting | null = null;
    private resizeInputSettings: Setting | null = null;
    // private submitButton: ButtonComponent | null = null;
    private resizeInputsDiv: HTMLDivElement | null = null;
    private enlargeReduceDiv: HTMLDivElement | null = null;

    constructor(
        app: App,
        private plugin: ImageConverterPlugin,
        private batchImageProcessor: BatchImageProcessor
    ) {
        super(app);
        this.modalEl.addClass("image-convert-modal");
    }

    onOpen() {
        const { contentEl } = this;
        this.createUI(contentEl);
    }

    onClose() {
        // Clear nullable UI elements
        this.enlargeReduceSettings = null;
        this.resizeInputSettings = null;
        this.resizeInputsDiv = null;
        this.enlargeReduceDiv = null;
    
        const { contentEl } = this;
        contentEl.empty();
    }

    // --- UI Creation Methods ---

    private createUI(contentEl: HTMLElement) {
        this.createHeader(contentEl);
        this.createWarningMessage(contentEl);

        const settingsContainer = contentEl.createDiv({
            cls: "settings-container",
        });

        const formatQualityContainer = settingsContainer.createDiv({
            cls: "format-quality-container",
        });
        this.createGeneralSettings(formatQualityContainer);

        const resizeContainer = settingsContainer.createDiv({
            cls: "resize-container",
        });
        this.createResizeSettings(resizeContainer);

        const skipContainer = settingsContainer.createDiv({
            cls: "skip-container",
        });
        this.createSkipSettings(skipContainer);

        this.createProcessButton(settingsContainer);
    }

    private createHeader(contentEl: HTMLElement) {
        const headerContainer = contentEl.createDiv({ cls: "modal-header" });
        headerContainer.createEl("h2", {
            text: "转换、压缩和缩放所有图片",
        });
        headerContainer.createEl("h6", {
            text: "在整个仓库中",
            cls: "modal-subtitle",
        });
    }

    private createWarningMessage(contentEl: HTMLElement) {
        contentEl.createEl("p", {
            cls: "modal-warning",
            // eslint-disable-next-line obsidianmd/ui/sentence-case -- Warning icon improves visibility
            text: "⚠️ 这将修改仓库中的所有图片，请确保已备份。",
        });
    }

    private createGeneralSettings(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName("转换为 ⓘ")
            .setDesc(
                "选择输出格式。'保持原格式'将对当前格式应用压缩/缩放"
            )
            .setTooltip(
                "保持原格式：保留当前格式，同时应用压缩/缩放"
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("disabled", "保持原格式")
                    .addOptions({
                        webp: "WebP",
                        jpg: "JPG",
                        png: "PNG",
                    })
                    .setValue(this.plugin.settings.ProcessAllVaultconvertTo)
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessAllVaultconvertTo = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(contentEl)
            .setName("质量 ⓘ")
            .setDesc("压缩级别 (0-100)")
            .setTooltip(
                "100：无压缩（原始质量）\n75：推荐（良好平衡）\n0-50：高压缩（较低质量）"
            )
            .addText((text) => {
                text
                    .setPlaceholder("输入质量 (0-100)")
                    .setValue(
                        (
                            this.plugin.settings.ProcessAllVaultquality * 100
                        ).toString()
                    )
                    .onChange(async (value) => {
                        const quality = parseInt(value, 10);
                        if (
                            !isNaN(quality) &&
                            quality >= 0 &&
                            quality <= 100
                        ) {
                            this.plugin.settings.ProcessAllVaultquality =
                                quality / 100;
                            await this.plugin.saveSettings();
                        }
                    });
            });
    }

    private createResizeSettings(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName("缩放模式 ⓘ")
            .setDesc(
                "选择图片的缩放方式。注意：结果不可逆"
            )
            .setTooltip(
                // eslint-disable-next-line obsidianmd/ui/sentence-case -- Structured tooltip format
                "适应：在尺寸范围内保持宽高比\n填充：精确匹配尺寸\n最长边：限制最长边\n最短边：限制最短边\n宽度/高度：约束单个维度"
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        None: "无",
                        Fit: "适应",
                        Fill: "填充",
                        LongestEdge: "最长边",
                        ShortestEdge: "最短边",
                        Width: "宽度",
                        Height: "高度",
                    })
                    .setValue(
                        this.plugin.settings
                            .ProcessAllVaultResizeModalresizeMode
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessAllVaultResizeModalresizeMode =
                            value;
                        await this.plugin.saveSettings();
                        this.updateResizeInputVisibility(value);
                    });
            });

        this.resizeInputsDiv = contentEl.createDiv({ cls: "resize-inputs" });
        this.enlargeReduceDiv = contentEl.createDiv({
            cls: "enlarge-reduce-settings",
        });

        this.updateResizeInputVisibility(
            this.plugin.settings.ProcessAllVaultResizeModalresizeMode
        );
    }

    private createSkipSettings(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName("跳过格式 ⓘ")
            .setDesc(
                // eslint-disable-next-line obsidianmd/ui/sentence-case -- Example format aids clarity
                "逗号分隔列表（不含点号或空格）。例如：png,gif"
            )
            .setTooltip(
                "要跳过的文件格式，逗号分隔列表（例如：tif,tiff,heic）。留空则处理所有格式。"
            )
            .addText((text) => {
                text.setPlaceholder(
                    // eslint-disable-next-line obsidianmd/ui/sentence-case -- Example format
                    "例如：png,gif"
                )
                    .setValue(this.plugin.settings.ProcessAllVaultSkipFormats)
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessAllVaultSkipFormats = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(contentEl)
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
                        this.plugin.settings.ProcessAllVaultskipImagesInTargetFormat
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.ProcessAllVaultskipImagesInTargetFormat =
                            value;
                        await this.plugin.saveSettings();
                    });
            });
    }

    private createProcessButton(contentEl: HTMLElement) {
        const buttonContainer = contentEl.createDiv({
            cls: "button-container",
        });
        new ButtonComponent(buttonContainer)
            .setButtonText("处理所有图片")
            .setCta()
            .onClick(async () => {
                this.close();
                await this.batchImageProcessor.processAllVaultImages();
            });
    }

    // --- Helper Methods for Settings ---

    private updateResizeInputVisibility(resizeMode: string): void {
        if (resizeMode === "None") {
            this.resizeInputsDiv?.empty();
            this.enlargeReduceDiv?.hide();
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
            this.enlargeReduceDiv?.show();
        }
    }

    private createEnlargeReduceSettings(): void {
        if (!this.enlargeReduceDiv) return;

        this.enlargeReduceDiv.empty();

        this.enlargeReduceSettings = new Setting(this.enlargeReduceDiv)
            .setClass("enlarge-reduce-setting")
            .setName("放大或缩小 ⓘ")
            .setDesc(
                "缩小并放大：调整所有图片。仅缩小：只缩小较大图片。仅放大：只放大较小图片"
            )
            .setTooltip(
                // eslint-disable-next-line obsidianmd/ui/sentence-case -- Bullet list format
                "• 缩小并放大：调整所有图片以匹配指定尺寸\n• 仅缩小：仅缩小大于目标尺寸的图片\n• 仅放大：仅放大小于目标尺寸的图片"
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        Always: "缩小并放大",
                        Reduce: "仅缩小",
                        Enlarge: "仅放大",
                    })
                    .setValue(
                        this.plugin.settings.ProcessAllVaultEnlargeOrReduce
                    )
                    .onChange(
                        async (value: "Always" | "Reduce" | "Enlarge") => {
                            this.plugin.settings.ProcessAllVaultEnlargeOrReduce =
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
                .addText((text) =>
                    text
                        .setPlaceholder("宽度")
                        .setValue(
                            this.plugin.settings
                                .ProcessAllVaultResizeModaldesiredWidth
                                .toString()
                        )
                        .onChange(async (value: string) => {
                            const width = parseInt(value);
                            if (/^\d+$/.test(value) && width > 0) {
                                this.plugin.settings.ProcessAllVaultResizeModaldesiredWidth =
                                    width;
                                await this.plugin.saveSettings();
                            }
                        })
                )
                .addText((text) =>
                    text
                        .setPlaceholder("高度")
                        .setValue(
                            this.plugin.settings
                                .ProcessAllVaultResizeModaldesiredHeight
                                .toString()
                        )
                        .onChange(async (value: string) => {
                            const height = parseInt(value);
                            if (/^\d+$/.test(value) && height > 0) {
                                this.plugin.settings.ProcessAllVaultResizeModaldesiredHeight =
                                    height;
                                await this.plugin.saveSettings();
                            }
                        })
                );
        } else {
            switch (resizeMode) {
                case "LongestEdge":
                case "ShortestEdge":
                    name = `${resizeMode}`;
                    desc = "输入期望的长度（像素）";
                    break;
                case "Width":
                    name = "宽度";
                    desc = "输入期望的宽度（像素）";
                    break;
                case "Height":
                    name = "高度";
                    desc = "输入期望的高度（像素）";
                    break;
            }

            this.resizeInputSettings
                .setName(name)
                .setDesc(desc)
                .addText((text) =>
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
            case "LongestEdge":
            case "ShortestEdge":
                return this.plugin.settings
                    .ProcessAllVaultResizeModaldesiredLength;
            case "Width":
                return this.plugin.settings
                    .ProcessAllVaultResizeModaldesiredWidth;
            case "Height":
                return this.plugin.settings
                    .ProcessAllVaultResizeModaldesiredHeight;
            default:
                return 0;
        }
    }

    private async updateSettingValue(
        resizeMode: string,
        value: number
    ): Promise<void> {
        switch (resizeMode) {
            case "LongestEdge":
            case "ShortestEdge":
                this.plugin.settings.ProcessAllVaultResizeModaldesiredLength =
                    value;
                break;
            case "Width":
                this.plugin.settings.ProcessAllVaultResizeModaldesiredWidth =
                    value;
                break;
            case "Height":
                this.plugin.settings.ProcessAllVaultResizeModaldesiredHeight =
                    value;
                break;
        }
        await this.plugin.saveSettings();
    }
}