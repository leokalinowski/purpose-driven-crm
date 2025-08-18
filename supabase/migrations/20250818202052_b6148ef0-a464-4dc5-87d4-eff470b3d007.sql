-- Create trigger to automatically log opportunity activities
CREATE TRIGGER log_opportunity_changes
AFTER INSERT OR UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.log_opportunity_activity();