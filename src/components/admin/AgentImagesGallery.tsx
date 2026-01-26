import { useState, useEffect, useRef } from 'react';
import { useAgentImages, AgentImage } from '@/hooks/useAgentImages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';

interface AgentImagesGalleryProps {
  userId: string;
}

const IMAGE_TYPES = [
  { value: 'headshot', label: 'Headshot' },
  { value: 'logo', label: 'Logo' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'background', label: 'Background' },
  { value: 'other', label: 'Other' },
];

export const AgentImagesGallery = ({ userId }: AgentImagesGalleryProps) => {
  const [images, setImages] = useState<AgentImage[]>([]);
  const [selectedType, setSelectedType] = useState('other');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { loading, fetchImages, uploadImage, deleteImage } = useAgentImages();

  useEffect(() => {
    if (userId) {
      loadImages();
    }
  }, [userId]);

  const loadImages = async () => {
    const data = await fetchImages(userId);
    setImages(data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const result = await uploadImage(userId, file, selectedType);
    if (result) {
      setImages(prev => [...prev, result]);
    }
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (image: AgentImage) => {
    const success = await deleteImage(image.id, image.image_url);
    if (success) {
      setImages(prev => prev.filter(img => img.id !== image.id));
    }
  };

  if (loading && images.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <Label>Image Type</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Image
          </Button>
        </div>
      </div>

      {/* Images Grid */}
      {images.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No images uploaded yet</p>
          <p className="text-sm text-muted-foreground">Upload images to build your gallery</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(image => (
            <Card key={image.id} className="overflow-hidden group relative">
              <CardContent className="p-0">
                <AspectRatio ratio={1}>
                  <img
                    src={image.image_url}
                    alt={image.name || 'Agent image'}
                    className="object-cover w-full h-full"
                  />
                </AspectRatio>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="text-white text-xs">
                    <span className="bg-primary/80 px-2 py-1 rounded">
                      {IMAGE_TYPES.find(t => t.value === image.image_type)?.label || image.image_type}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-white text-sm truncate flex-1 mr-2">
                      {image.name || 'Untitled'}
                    </span>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(image)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
