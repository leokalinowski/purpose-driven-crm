import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'

interface CSVFile {
  id: string;
  filename: string;
  file_size: number;
  upload_date: string;
  is_active: boolean;
}

export function CSVUploadManager() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<CSVFile[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const { session } = useAuth()

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    fetchUploadedFiles()
  }, [])

  const fetchUploadedFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_csv_files')
        .select('*')
        .order('upload_date', { ascending: false })

      if (error) throw error
      setUploadedFiles(data || [])
    } catch (error) {
      console.error('Error fetching uploaded files:', error)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' })
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Please select a CSV file' })
      return
    }
    
    setUploading(true)
    setMessage(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const { data: { access_token } } = await supabase.auth.getSession()
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
        body: formData
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }
      
      setMessage({ 
        type: 'success', 
        text: `File uploaded successfully! Processed ${result.processed_rows} rows.` 
      })
      
      setFile(null)
      await fetchUploadedFiles()
      
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const toggleFileStatus = async (fileId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('newsletter_csv_files')
        .update({ is_active: !currentStatus })
        .eq('id', fileId)

      if (error) throw error
      await fetchUploadedFiles()
    } catch (error) {
      console.error('Error updating file status:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Market Data CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Upload your monthly market data CSV file. The file should contain columns for zip_code, median_listing_price, city, state, etc.
            </p>
          </div>
          
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? 'Uploading and Processing...' : 'Upload CSV'}
          </Button>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files</CardTitle>
        </CardHeader>
        <CardContent>
          {uploadedFiles.length === 0 ? (
            <p className="text-muted-foreground">No CSV files uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map((csvFile) => (
                <div key={csvFile.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{csvFile.filename}</span>
                      <Badge variant={csvFile.is_active ? 'default' : 'secondary'}>
                        {csvFile.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(csvFile.file_size)} • Uploaded {formatDate(csvFile.upload_date)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFileStatus(csvFile.id, csvFile.is_active)}
                  >
                    {csvFile.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
