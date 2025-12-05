// Carousel functionality for one-liners
const carouselItems = document.querySelectorAll('.carousel-item');
let currentIndex = 0;

function rotateCarousel() {
    // Remove active class from current item
    carouselItems[currentIndex].classList.remove('active');
    
    // Move to next item
    currentIndex = (currentIndex + 1) % carouselItems.length;
    
    // Add active class to new item
    carouselItems[currentIndex].classList.add('active');
}

// Start carousel rotation
if (carouselItems.length > 0) {
    // Initial delay before first rotation
    setTimeout(() => {
        setInterval(rotateCarousel, 3000); // Rotate every 4 seconds
    }, 3000); // Wait 3 seconds before starting
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile menu toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');
const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');

function toggleMobileMenu(isOpen) {
    if (mobileMenuToggle && navLinks && mobileMenuOverlay) {
        mobileMenuToggle.setAttribute('aria-expanded', isOpen);
        if (isOpen) {
            navLinks.classList.add('active');
            mobileMenuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            navLinks.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
}

if (mobileMenuToggle && navLinks && mobileMenuOverlay) {
    mobileMenuToggle.addEventListener('click', () => {
        const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
        toggleMobileMenu(!isExpanded);
    });
    
    // Close menu when clicking on overlay
    mobileMenuOverlay.addEventListener('click', () => {
        toggleMobileMenu(false);
    });
    
    // Close menu when clicking on a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggleMobileMenu(false);
        });
    });
}

// Add scroll effect to navbar
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all feature cards and use case cards
document.querySelectorAll('.feature-card, .use-case-card, .benefit-item').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

