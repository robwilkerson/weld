public class Example {
    private int x;
    private int y;
    
    public Example() {
        x = 0;
        y = 0;
    }
    
    public void setX(int val) {
        x = val;
    }
    
    public void setY(int val) {
        y = val;
    }
    
    public int getX() {
        return x;
    }
    
    public int getY() {
        return y;
    }
    
    public void reset() {
        // This is an extremely long comment line that will definitely cause a horizontal scrollbar to appear in the diff viewer when comparing these two files side by side
        x = 0;
        y = 0;
    }
    
    public String toString() {
        return "(" + x + ", " + y + ")";
    }
}