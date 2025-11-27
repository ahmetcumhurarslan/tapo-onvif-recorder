/* rtc-pi.c 
   
   Function: Read/Write the DS1302 Real-Time Clock (RTC) chip and synchronize 
             the Raspberry Pi 3 (BCM2837) system clock.
   
   Pin mapping (Standard 40-pin Header):
   - CE (Chip Enable) : GPIO 17 (Pin 11)
   - IO (Data)        : GPIO 18 (Pin 12)
   - SCLK (Clock)     : GPIO 27 (Pin 13)
*/

#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <time.h>
#include <string.h>
#include <errno.h>
#include <sys/mman.h>
#include <sys/time.h>

/* --- RASPBERRY PI 3 CONFIGURATION --- */
/* BCM2837 (Pi 3) peripheral base is 0x3F000000. GPIO offset is 0x00200000. */
#define GPIO_ADD    0x3F200000L // Physical address of I/O peripherals for Pi 3
/* ------------------------------------ */

#define GPIO_SEL1   1           // FSEL register for GP10-GP19 (GPIO 17/18)  
#define GPIO_SEL2   2           // FSEL register for GP20-GP29 (GPIO 27) 
#define GPIO_SET    7           // PIN HIGH register  
#define GPIO_CLR    10          // PIN LOW register  
#define GPIO_INP    13          // PIN INPUT value register  
#define PAGE_SIZE   4096        
#define BLOCK_SIZE  PAGE_SIZE

/* RTC Chip register definitions (DS1302) */
#define SEC_WRITE    0x80
#define MIN_WRITE    0x82
#define HOUR_WRITE   0x84
#define DATE_WRITE   0x86
#define MONTH_WRITE  0x88
#define YEAR_WRITE   0x8C
#define SEC_READ     0x81
#define MIN_READ     0x83
#define HOUR_READ    0x85
#define DATE_READ    0x87
#define MONTH_READ   0x89
#define YEAR_READ    0x8D

int  mem_fd     = 0;
char *gpio_mmap = NULL;
char *gpio_ram  = NULL;
volatile unsigned int *gpio = NULL;

/* Pin Configuration Macros (GPIO 17, 18, 27) */

// Configure IO (GPIO 18) as Input: Clear bits 24-26 in SEL1
#define IO_INPUT    *(gpio+GPIO_SEL1) &= 0xF8FFFFFFL

// Configure IO (GPIO 18) as Output: Set bits 24-26 to 001
#define IO_OUTPUT   *(gpio+GPIO_SEL1) &= 0xF8FFFFFFL; *(gpio+GPIO_SEL1) |= 0x01000000L 

// Configure SCLK (GPIO 27) as Output: Set bits 21-23 in SEL2 to 001
#define SCLK_OUTPUT *(gpio+GPIO_SEL2) &= 0xFF1FFFFFL; *(gpio+GPIO_SEL2) |= 0x00200000L

// Configure CE (GPIO 17) as Output: Set bits 21-23 in SEL1 to 001
#define CE_OUTPUT   *(gpio+GPIO_SEL1) &= 0xFF1FFFFFL; *(gpio+GPIO_SEL1) |= 0x00200000L

// Bit manipulation for setting/clearing pins
#define IO_HIGH     *(gpio+GPIO_SET) = 0x00040000L  // GPIO 18 High
#define IO_LOW      *(gpio+GPIO_CLR) = 0x00040000L  // GPIO 18 Low

#define SCLK_HIGH   *(gpio+GPIO_SET) = 0x08000000L  // GPIO 27 High
#define SCLK_LOW    *(gpio+GPIO_CLR) = 0x08000000L  // GPIO 27 Low

#define CE_HIGH     *(gpio+GPIO_SET) = 0x00020000L  // GPIO 17 High
#define CE_LOW      *(gpio+GPIO_CLR) = 0x00020000L  // GPIO 17 Low

#define IO_LEVEL    (*(gpio+GPIO_INP) & 0x00040000L) // Check level of GPIO 18

void setup_io()
{
   /* Open /dev/mem to get access to physical ram */
   if ((mem_fd = open("/dev/mem", O_RDWR|O_SYNC) ) < 0) {
      printf("can't open /dev/mem. Did you run the program with administrator rights (sudo)?\n");
      exit (-1);
   }

   /* Allocate a block of virtual RAM */
   if ((gpio_ram = malloc(BLOCK_SIZE + (PAGE_SIZE-1))) == NULL) {
      printf("allocation error \n");
      exit (-1);
   }

   /* Align the pointer on a 4K boundary */
   if ((unsigned long)gpio_ram % PAGE_SIZE)
     gpio_ram += PAGE_SIZE - ((unsigned long)gpio_ram % PAGE_SIZE);

   /* Map the physical addresses of the GPIO control registers into our address space */
   gpio_mmap = (unsigned char *)mmap(
      (caddr_t)gpio_ram,
      BLOCK_SIZE,
      PROT_READ|PROT_WRITE,
      MAP_SHARED|MAP_FIXED,
      mem_fd,
      GPIO_ADD
   );

   if ((long)gpio_mmap < 0) {
      printf("unable to map the memory. Did you run the program with administrator rights?\n");
      exit (-1);
   }

   /* Use a volatile pointer to hardware registers */
   gpio = (volatile unsigned *)gpio_mmap;

   /* Set up pin directions */
   SCLK_OUTPUT;
   IO_OUTPUT;
   CE_OUTPUT;

   /* Set default state (low) */
   SCLK_LOW;
   IO_LOW;
   CE_LOW;

   usleep(2);
}

unsigned char read_rtc( unsigned char add )
{
   unsigned char val;
   int lp;

   val = add;

   if ( !(add & 1 ) ) { // Check LSB for read address
      printf("Incorrect read address specified - LSB must be set.\n");
      exit (-1);
   }

   if ( (add < 0x81) || (add > 0x91) ) { // Check address range
      printf("Incorrect read address specified - It must be in the range 0x81..0x91\n");
      exit (-1);
   }

   CE_HIGH;
   usleep(2);

   /* Write the address byte (LSB first) */
   for (lp=0; lp<8; lp++) {
      if (val & 1) IO_HIGH;
      else IO_LOW;
      val >>= 1; 
      usleep(2);
      SCLK_HIGH;
      usleep(2);
      SCLK_LOW;
      usleep(2);      
   }
   
   /* Switch IO pin to Input mode to read data */
   IO_INPUT; 

   /* Read the data byte (LSB first) */
   for (lp=0; lp<8; lp++) {
      usleep(2);
      val >>= 1;
      if (IO_LEVEL) val |= 0x80;
      else val &= 0x7F;          
      SCLK_HIGH;
      usleep(2);
      SCLK_LOW;
      usleep(2);
   }
   
   /* Reset I/O pin to default (output low) */
   IO_LOW;
   IO_OUTPUT;
   
   CE_LOW;
   usleep(2);      

   return val;
}

void write_rtc( unsigned char add, unsigned char val_to_write )
{
   unsigned char val;
   int lp;

   if ( add & 1 ) { // Check LSB for write address
      printf("Incorrect write address specified - LSB must be cleared.\n");
      exit (-1);
   }

   if ( (add < 0x80) || (add > 0x90) ) { // Check address range
      printf("Incorrect write address specified - It must be in the range 0x80..0x90\n");
      exit (-1);
   }

   CE_HIGH;
   usleep(2);

   val = add;

   /* Write Address */
   for (lp=0; lp<8; lp++) {
      if (val & 1) IO_HIGH;
      else IO_LOW;
      val >>= 1; 
      usleep(2);
      SCLK_HIGH;
      usleep(2);
      SCLK_LOW;
      usleep(2);      
   }

   val = val_to_write;

   /* Write Data */
   for (lp=0; lp<8; lp++) {
      if (val & 1) IO_HIGH;
      else IO_LOW;
      val >>= 1; 
      usleep(2);
      SCLK_HIGH;
      usleep(2);
      SCLK_LOW;
      usleep(2);      
   }

   IO_LOW;
   CE_LOW;
   usleep(2);      
}

int main(int argc, char **argv)
{ 
   int lp;
   unsigned char second, minute, hour, day, month, year;
   int i_year, i_month, i_day, i_hour, i_minute, i_second;
   time_t epoch_time;
   struct tm time_requested;
   struct timeval time_setformat;
    
   if ( argc > 2 ) {
      printf("Too many arguments specified.\nRun as:\nrtc-pi\nor\nrtc-pi CCYYMMDDHHMMSS\n");
      exit (-1);
   } 

   setup_io();
       
   if ( argc == 2 ) {
      /* ---------------------------------------------------- */
      /* WRITE MODE: Write input time to RTC and set system clock */
      /* ---------------------------------------------------- */
      
      sscanf(argv[1],"%4d%2d%2d%2d%2d%2d",&i_year,&i_month,&i_day,&i_hour,&i_minute,&i_second);
       
      if ( (i_year < 2000) || (i_year > 2099) || (i_month < 1) || (i_month > 12) ||
            (i_day < 1) || (i_day>31) || (i_hour < 0) || (i_hour > 23) || (i_minute < 0) ||
            (i_minute > 59) || (i_second < 0) || (i_second > 59) ) {
         printf("Incorrect date and time specified.\n");
         exit (-1);
      }

      // Write values in packed BCD format to the DS1302
      write_rtc(SEC_WRITE, ( (i_second/10) << 4) | ( i_second % 10) );
      write_rtc(MIN_WRITE, ( (i_minute/10) << 4) | ( i_minute % 10) );
      write_rtc(HOUR_WRITE, ( (i_hour/10) << 4) | ( i_hour % 10) );
      write_rtc(DATE_WRITE, ( (i_day/10) << 4) | ( i_day % 10) );
      write_rtc(MONTH_WRITE, ( (i_month/10) << 4) | ( i_month % 10) );
      write_rtc(YEAR_WRITE, ( ((i_year-2000)/10) << 4) | (i_year % 10) );   

      /* Prepare time structure for system clock setting */
      time_requested.tm_sec = i_second;
      time_requested.tm_min = i_minute;
      time_requested.tm_hour = i_hour;
      time_requested.tm_mday = i_day;
      time_requested.tm_mon = i_month-1;
      time_requested.tm_year = i_year-1900;
      time_requested.tm_wday = 0; 
      time_requested.tm_yday = 0; 
      time_requested.tm_isdst = -1; 
       
      epoch_time = mktime(&time_requested);
      time_setformat.tv_sec = epoch_time;
      time_setformat.tv_usec = 0;
      
      printf("Set RTC time to: %4d-%02d-%02d %02d:%02d:%02d (UNIX: %lld)\n", 
              i_year, i_month, i_day, i_hour, i_minute, i_second, (long long) epoch_time );
              
      /* Set the system clock */
      lp = settimeofday(&time_setformat,NULL);

      if ( lp < 0 ) {  
         printf("Unable to change the system time. (Try sudo)\n");
         printf("Error: \"%s\"\n", strerror( errno ) );
         exit (-1);
      }
       
   } else {
      /* ---------------------------------------------------- */
      /* READ MODE: Read time from RTC and set system clock */
      /* ---------------------------------------------------- */
      
      second = read_rtc(SEC_READ);
      minute = read_rtc(MIN_READ);
      hour = read_rtc(HOUR_READ);
      day = read_rtc(DATE_READ);
      month = read_rtc(MONTH_READ);
      year = read_rtc(YEAR_READ);   

      /* Convert BCD time values (from RTC) to standard integers */
      i_second = (((second & 0x70) >> 4) * 10) + (second & 0x0F);
      i_minute = (((minute & 0x70) >> 4) * 10) + (minute & 0x0F);
      i_hour = (((hour & 0x30) >> 4) * 10) + (hour & 0x0F);
      i_day = (((day & 0x30) >> 4) * 10) + (day & 0x0F);
      i_month = (((month & 0x10) >> 4) * 10) + (month & 0x0F);
      i_year = (((year & 0xF0) >> 4) * 10) + (year & 0x0F) + 2000;
      
      /* Populate tm structure */
      time_requested.tm_sec = i_second;
      time_requested.tm_min = i_minute;
      time_requested.tm_hour = i_hour;
      time_requested.tm_mday = i_day;
      time_requested.tm_mon = i_month - 1; 
      time_requested.tm_year = i_year - 1900;
      time_requested.tm_wday = 0; 
      time_requested.tm_yday = 0; 
      time_requested.tm_isdst = -1; 
       
      /* Convert to Epoch time for the system clock */
      epoch_time = mktime(&time_requested);
      time_setformat.tv_sec = epoch_time;
      time_setformat.tv_usec = 0;
      
      printf("Read RTC time: %4d-%02d-%02d %02d:%02d:%02d (UNIX: %lld)\n", 
              i_year, i_month, i_day, i_hour, i_minute, i_second, (long long) epoch_time );

      /* Set the system clock */
      lp = settimeofday(&time_setformat,NULL);

      if ( lp < 0 ) {  
         printf("Unable to change the system time. (Try sudo)\n");
         printf("Error: \"%s\"\n", strerror( errno ) );
         exit (-1);
      }
   }

   return 0;
}
