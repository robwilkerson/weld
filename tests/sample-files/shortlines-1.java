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
        x = 0;
        y = 0;
    }
    
    public String toString() {
        return "(" + x + ", " + y + ")";
    }
}