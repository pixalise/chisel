import { convertImagesSchema, type ConvertImages, type ConvertedImage } from "../../shared/schemas";

class ImageConversionService {
  public async chooseOutputFolder(): Promise<string | null> {
    return window.electron.openFolderDialog();
  }

  public async convert(input: ConvertImages): Promise<ConvertedImage[]> {
    return window.electron.convertImages(convertImagesSchema.parse(input));
  }

  public async createPreview(inputPath: string): Promise<string> {
    return window.electron.createImageConversionPreview(inputPath);
  }
}

const imageConversionService = new ImageConversionService();

export default imageConversionService;
