import { useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useCSVUpload, type CSVPost } from '@/hooks/useSocialScheduler';
import { useToast } from '@/hooks/use-toast';

interface SocialCSVUploadProps {
  agentId?: string;
}

interface CSVPreview {
  valid: CSVPost[];
  invalid: { row: number; data: any; errors: string[] }[];
}

export function SocialCSVUpload({ agentId }: SocialCSVUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const csvUpload = useCSVUpload();
  const { toast } = useToast();

  const validateCSVRow = (row: any, index: number): { post?: CSVPost; errors: string[] } => {
    const errors: string[] = [];
    
    if (!row.content || typeof row.content !== 'string' || !row.content.trim()) {
      errors.push('Content is required');
    }
    
    if (!row.platform || typeof row.platform !== 'string') {
      errors.push('Platform is required');
    } else {
      const validPlatforms = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok'];
      if (!validPlatforms.includes(row.platform.toLowerCase())) {
        errors.push(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
      }
    }
    
    if (!row.schedule_time || typeof row.schedule_time !== 'string') {
      errors.push('Schedule time is required');
    } else {
      const date = new Date(row.schedule_time);
      if (isNaN(date.getTime())) {
        errors.push('Invalid schedule time format. Use ISO format: YYYY-MM-DDTHH:mm:ss');
      } else if (date < new Date()) {
        errors.push('Schedule time must be in the future');
      }
    }
    
    if (errors.length === 0) {
      return {
        post: {
          content: row.content.trim(),
          platform: row.platform.toLowerCase(),
          schedule_time: row.schedule_time,
          media_file: row.media_file || undefined,
        },
        errors: [],
      };
    }
    
    return { errors };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file.',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(selectedFile);
    setPreview(null);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const valid: CSVPost[] = [];
        const invalid: { row: number; data: any; errors: string[] }[] = [];
        
        results.data.forEach((row: any, index) => {
          const validation = validateCSVRow(row, index);
          if (validation.post) {
            valid.push(validation.post);
          } else {
            invalid.push({
              row: index + 1,
              data: row,
              errors: validation.errors,
            });
          }
        });
        
        setPreview({ valid, invalid });
      },
      error: (error) => {
        toast({
          title: 'CSV parsing error',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    try {
      await csvUpload.mutateAsync({ file, agentId });
      setFile(null);
      setPreview(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        content: 'Your post content here',
        platform: 'facebook',
        schedule_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        media_file: 'optional-filename.jpg',
      },
      {
        content: 'Another post for Instagram',
        platform: 'instagram',
        schedule_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        media_file: '',
      },
    ];
    
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'social-posts-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload Posts</CardTitle>
        <CardDescription>
          Upload a CSV file to schedule multiple posts at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            CSV should contain columns: content, platform, schedule_time, media_file (optional).
            Platform must be one of: facebook, instagram, linkedin, twitter, tiktok.
            Schedule time must be in ISO format (YYYY-MM-DDTHH:mm:ss).
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="csv-file">Select CSV File</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="flex-1"
            />
            {file && (
              <Badge variant="secondary" className="whitespace-nowrap">
                {file.name}
              </Badge>
            )}
          </div>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  {preview.valid.length} valid posts
                </span>
              </div>
              {preview.invalid.length > 0 && (
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">
                    {preview.invalid.length} invalid rows
                  </span>
                </div>
              )}
            </div>

            {preview.invalid.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Errors found:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {preview.invalid.map((item) => (
                    <div key={item.row} className="text-sm bg-red-50 p-2 rounded border">
                      <div className="font-medium">Row {item.row}:</div>
                      <ul className="list-disc list-inside text-red-600">
                        {item.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.valid.length > 0 && (
              <Button
                onClick={handleUpload}
                disabled={isProcessing}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isProcessing ? 'Processing...' : `Schedule ${preview.valid.length} Posts`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}